import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { DataView } from './components/DataView';
import { Header } from './components/Header';
import { InputView } from './components/InputView';
import { EditStudentModal, PhotoPreviewModal } from './components/Modals';
import { PWAPromptModal } from './components/PWAPromptModal';
import { RekapView } from './components/RekapView';
import { SettingsView } from './components/SettingsView';
import { SuratView } from './components/SuratView';
import { auth, googleProvider } from './firebase';
import { usePWAInstall } from './hooks/usePWAInstall';
import type {
  CoreData,
  DraftMap,
  DraftRow,
  ExtraEntry,
  MonthMap,
  Student,
  TabKey,
  ThemeMode,
  ToastMessage,
} from './types/sims';
import { compressImageFile } from './utils/cryptoStorage';
import {
  loadPhotoFromFirestore,
  loadSchoolDataFromFirestore,
  savePhotoToFirestore,
  syncDirtyToFirestore,
} from './utils/firestoreSync';
import {
  buildDraftRow,
  consecutiveSickDays,
  createEmptyCoreData,
  createSeedData,
  ensureClass,
  ensureTeacher,
  generateAutoNis,
  getDefaultSchoolDate,
  getExtra,
  getMissingDocs,
  getStatus,
  inferGender,
  isWeekday,
  needsLetter,
  normalizeText,
  parseBulkLine,
  parseDate,
  PHOTO_PLACEHOLDER,
  purgeStudentAttendance,
  putAttendance,
} from './utils/simsLogic';

function applyThemeMode(mode: ThemeMode): void {
  localStorage.setItem('sims_theme', mode);
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = mode === 'dark' || (mode === 'auto' && prefersDark);
  document.documentElement.classList.toggle('dark', shouldBeDark);
}

function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau password salah, atau akun belum terdaftar.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Pilih Masuk atau gunakan fitur Lupa password.';
    case 'auth/weak-password':
      return 'Password terlalu lemah. Gunakan minimal 8 karakter.';
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan login. Tunggu beberapa saat lalu coba lagi.';
    case 'auth/operation-not-allowed':
      return 'Login Email/Password belum diaktifkan di Firebase Console. Aktifkan provider Email/Password terlebih dahulu atau gunakan Masuk dengan Google.';
    case 'auth/popup-closed-by-user':
      return 'Jendela login Google ditutup sebelum selesai.';
    case 'auth/popup-blocked':
      return 'Popup login diblokir browser. Izinkan popup lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Gagal terhubung ke server Firebase. Periksa koneksi internet Anda.';
    default:
      return 'Gagal memproses autentikasi. Silakan coba lagi.';
  }
}

export default function App() {
  const todayStr = useMemo(() => getDefaultSchoolDate(), []);

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('sims_theme');
    return saved === 'light' || saved === 'dark' || saved === 'auto'
      ? saved
      : 'auto';
  });

  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<'reg' | 'in'>('in');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(
    null
  );

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const pwa = usePWAInstall();

  const [core, setCore] = useState<CoreData>(() => createEmptyCoreData());
  const [months, setMonths] = useState<MonthMap>({});
  const [activeTab, setActiveTab] = useState<TabKey>('dash');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );

  // Input attendance state
  const [inputClassId, setInputClassId] = useState(0);
  const [inputDate, setInputDate] = useState(todayStr);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [inputFeedback, setInputFeedback] = useState<{
    text: string;
    bad: boolean;
  } | null>(null);

  // Photo cache & modals
  const [photoCache, setPhotoCache] = useState<Record<string, string>>({});
  const [previewPhoto, setPreviewPhoto] = useState<{
    src: string;
    caption: string;
  } | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Refs for reliable debounced cloud flush
  const dirtyRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<number | null>(null);
  const flushingRef = useRef(false);
  const lastSyncedCoreRef = useRef<CoreData>(createEmptyCoreData());
  const knownMonthKeysRef = useRef<Set<string>>(new Set());
  const stateRef = useRef({ uid: '', core, months });
  stateRef.current = { uid: currentUser?.uid || '', core, months };

  const showToast = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3600);
  }, []);

  useEffect(() => {
    applyThemeMode(theme);
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemeMode('auto');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const { openPopupOnEntry, closePopup } = pwa;

  const hydrateUserSession = useCallback(
    async (user: User) => {
      const loaded = await loadSchoolDataFromFirestore(user.uid, user.email || '');
      lastSyncedCoreRef.current = structuredClone(loaded.core);
      knownMonthKeysRef.current = loaded.knownMonthKeys;
      dirtyRef.current.clear();
      setCurrentUser(user);
      setEmail(user.email || '');
      setCore(loaded.core);
      setMonths(loaded.months);
      setInputClassId(loaded.core.c[0]?.id || 0);
      setDrafts({});
      setPhotoCache({});
      setInputFeedback(null);
      setPendingVerificationEmail(null);
      setActiveTab('dash');
      setSaveStatus('idle');
      setAuthError('');
      setAuthNotice('');
      openPopupOnEntry();
    },
    [openPopupOnEntry]
  );

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      if (!user) {
        setCurrentUser(null);
        setEmail('');
        setPendingVerificationEmail(null);
        setCore(createEmptyCoreData());
        setMonths({});
        lastSyncedCoreRef.current = createEmptyCoreData();
        knownMonthKeysRef.current = new Set();
        closePopup();
        setReady(true);
        return;
      }

      if (!user.emailVerified) {
        setCurrentUser(null);
        setPendingVerificationEmail(user.email || 'email Anda');
        closePopup();
        setReady(true);
        return;
      }

      try {
        await hydrateUserSession(user);
      } catch {
        setAuthError('Gagal memuat data sekolah dari server cloud. Coba muat ulang halaman.');
        setCurrentUser(null);
      } finally {
        if (active) setReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [hydrateUserSession, closePopup]);

  const cycleTheme = useCallback(() => {
    const order: ThemeMode[] = ['auto', 'light', 'dark'];
    setTheme((prev) => order[(order.indexOf(prev) + 1) % order.length]);
  }, []);

  const flushDirty = useCallback(async () => {
    if (flushingRef.current) return;
    const { uid } = stateRef.current;
    if (!uid || dirtyRef.current.size === 0) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    flushingRef.current = true;
    const keysToFlush = [...dirtyRef.current];
    dirtyRef.current.clear();

    try {
      const latest = stateRef.current;
      await syncDirtyToFirestore({
        uid,
        prevCore: lastSyncedCoreRef.current,
        nextCore: latest.core,
        nextMonths: latest.months,
        knownMonthKeys: knownMonthKeysRef.current,
        dirtyKeys: keysToFlush,
      });
      if (keysToFlush.includes('core')) {
        lastSyncedCoreRef.current = structuredClone(latest.core);
      }
      setSaveStatus('saved');
    } catch {
      keysToFlush.forEach((k) => dirtyRef.current.add(k));
      setSaveStatus('error');
    } finally {
      flushingRef.current = false;
      if (
        dirtyRef.current.size > 0 &&
        stateRef.current.uid &&
        (typeof navigator === 'undefined' || navigator.onLine)
      ) {
        void flushDirty();
      }
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (dirtyRef.current.size > 0 && stateRef.current.uid) {
        showToast('Koneksi kembali online. Menyinkronkan data...');
        setSaveStatus('saving');
        void flushDirty();
      } else {
        showToast('Koneksi kembali online.');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast(
        'Koneksi terputus (mode offline). Perubahan belum tersinkronisasi.',
        true
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushDirty, showToast]);

  const markDirty = useCallback(
    (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach((k) => dirtyRef.current.add(k));
      setSaveStatus('saving');
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = window.setTimeout(() => {
        void flushDirty();
      }, 650);
    },
    [flushDirty]
  );

  const handleAuthSubmit = async (rawEmail: string, pw: string, pw2: string) => {
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setAuthError('Masukkan alamat email yang valid.');
      return;
    }
    if (pw.length < 8) {
      setAuthError('Password minimal 8 karakter.');
      return;
    }

    setAuthError('');
    setAuthNotice('');
    try {
      if (authMode === 'reg') {
        if (pw !== pw2) {
          setAuthError('Ulangi password tidak sama.');
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pw);
        await sendEmailVerification(cred.user);
        setPendingVerificationEmail(cred.user.email || cleanEmail);
        setAuthNotice('Email verifikasi berhasil dikirim.');
      } else {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, pw);
        if (!cred.user.emailVerified) {
          setPendingVerificationEmail(cred.user.email || cleanEmail);
          setAuthNotice('Silakan selesaikan verifikasi email terlebih dahulu.');
        }
      }
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthNotice('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    }
  };

  const handleResetPassword = async (rawEmail: string) => {
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setAuthError('Masukkan email sekolah Anda terlebih dahulu untuk reset password.');
      return;
    }
    setAuthError('');
    setAuthNotice('');
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setAuthNotice(`Link reset password telah dikirim ke ${cleanEmail}.`);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    }
  };

  const handleCheckVerification = async () => {
    const user = auth.currentUser;
    if (!user) {
      setPendingVerificationEmail(null);
      return;
    }
    setAuthError('');
    setAuthNotice('');
    try {
      await user.reload();
      await user.getIdToken(true);
      if (user.emailVerified) {
        await hydrateUserSession(user);
      } else {
        setAuthError(
          'Email belum terverifikasi. Klik tautan pada email verifikasi lalu coba lagi.'
        );
      }
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    }
  };

  const handleResendVerification = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setAuthError('');
    setAuthNotice('');
    try {
      await sendEmailVerification(user);
      setAuthNotice(`Email verifikasi dikirim ulang ke ${user.email || 'alamat Anda'}.`);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    }
  };

  const handleCancelVerification = async () => {
    setAuthError('');
    setAuthNotice('');
    setPendingVerificationEmail(null);
    await signOut(auth);
  };

  const handleLogout = async () => {
    if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
    await flushDirty();
    dirtyRef.current.clear();
    await signOut(auth);
    setCurrentUser(null);
    setEmail('');
    setCore(createEmptyCoreData());
    setMonths({});
    lastSyncedCoreRef.current = createEmptyCoreData();
    knownMonthKeysRef.current = new Set();
    setDrafts({});
    setPhotoCache({});
    setInputFeedback(null);
    setSaveStatus('idle');
    setAuthMode('in');
    setAuthError('');
    setAuthNotice('');
  };

  const handleLoadSeed = () => {
    const {
      core: seededCore,
      months: seededMonths,
      touchedMonths,
    } = createSeedData(core, todayStr);
    setCore(seededCore);
    setMonths(seededMonths);
    setInputClassId(seededCore.c[0]?.id || 0);
    setDrafts({});
    stateRef.current = {
      ...stateRef.current,
      core: seededCore,
      months: seededMonths,
    };
    markDirty(['core', ...touchedMonths]);
    showToast('Data contoh berhasil dimuat.');
  };

  const effectiveInputClassId = useMemo(() => {
    if (core.c.some((c) => c.id === inputClassId)) return inputClassId;
    return core.c[0]?.id || 0;
  }, [core.c, inputClassId]);

  const getMergedDraft = useCallback(
    (student: Student, dateStr: string, draftMap: DraftMap): DraftRow =>
      draftMap[student.id] || buildDraftRow(months, student, dateStr),
    [months]
  );

  const handleSelectStatus = (studentId: number, status: 'H' | 'S' | 'I' | 'A') => {
    const student = core.st.find((s) => s.id === studentId);
    if (!student) return;
    setDrafts((prev) => {
      const base = getMergedDraft(student, inputDate, prev);
      return {
        ...prev,
        [studentId]: {
          ...base,
          st: status,
          leaveTime: status === 'I' ? base.leaveTime : '',
          defer: status !== 'S' && status !== 'I' ? false : base.defer,
        },
      };
    });
    setInputFeedback(null);
  };

  const handleChangeNote = (studentId: number, note: string) => {
    const student = core.st.find((s) => s.id === studentId);
    if (!student) return;
    setDrafts((prev) => {
      const base = getMergedDraft(student, inputDate, prev);
      return { ...prev, [studentId]: { ...base, note } };
    });
  };

  const handleChangeLeaveTime = (studentId: number, leaveTime: string) => {
    const student = core.st.find((s) => s.id === studentId);
    if (!student) return;
    setDrafts((prev) => {
      const base = getMergedDraft(student, inputDate, prev);
      return { ...prev, [studentId]: { ...base, leaveTime } };
    });
    setInputFeedback(null);
  };

  const handleToggleDefer = (studentId: number, defer: boolean) => {
    const student = core.st.find((s) => s.id === studentId);
    if (!student) return;
    setDrafts((prev) => {
      const base = getMergedDraft(student, inputDate, prev);
      return { ...prev, [studentId]: { ...base, defer } };
    });
  };

  const handleFillAllPresent = () => {
    const studentsInClass = core.st.filter((s) => s.c === effectiveInputClassId);
    setDrafts((prev) => {
      const next = { ...prev };
      studentsInClass.forEach((s) => {
        const cur = getMergedDraft(s, inputDate, next);
        if (!cur.st) next[s.id] = { ...cur, st: 'H' };
      });
      return next;
    });
    showToast('Seluruh siswa yang belum dipilih diisi Hadir.');
  };

  const handleUploadInputPhoto = async (studentId: number, file: File) => {
    if (!currentUser) return;
    const student = core.st.find((s) => s.id === studentId);
    if (!student) return;
    try {
      const compressed = await compressImageFile(file);
      const pid =
        'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await savePhotoToFirestore(currentUser.uid, pid, compressed.u);
      setPhotoCache((prev) => ({ ...prev, [pid]: compressed.u }));
      setDrafts((prev) => {
        const cur = getMergedDraft(student, inputDate, prev);
        return {
          ...prev,
          [studentId]: {
            ...cur,
            doc: { pid, n: compressed.n, k: compressed.k, o: compressed.o },
            defer: false,
          },
        };
      });
      showToast(`Foto surat dikompresi & diunggah (${compressed.k} KB).`);
    } catch {
      const msg = 'Gagal memproses foto. Pilih file JPG, PNG, atau WebP lalu coba lagi.';
      setInputFeedback({ text: msg, bad: true });
      showToast(msg, true);
    }
  };

  const handleSaveAttendance = () => {
    if (!isWeekday(parseDate(inputDate))) {
      const msg =
        'Tanggal ini bukan hari sekolah (Sabtu/Minggu). Pilih hari Senin sampai Jumat.';
      setInputFeedback({ text: msg, bad: true });
      showToast(msg, true);
      return;
    }

    const studentsInClass = core.st.filter((s) => s.c === effectiveInputClassId);
    const rowsToSave = studentsInClass
      .map((s) => ({ s, row: getMergedDraft(s, inputDate, drafts) }))
      .filter(({ row }) => Boolean(row.st));

    if (!rowsToSave.length) {
      const msg = 'Belum ada status kehadiran yang dipilih.';
      setInputFeedback({ text: msg, bad: true });
      showToast(msg, true);
      return;
    }

    const errors: string[] = [];
    rowsToSave.forEach(({ s, row }) => {
      const streak =
        row.st === 'S' ? consecutiveSickDays(months, s.id, inputDate) + 1 : 0;
      if (needsLetter(row.st, streak) && !row.doc && !row.defer) {
        errors.push(
          `${s.n}: ${row.st === 'I' ? 'izin' : `sakit hari ke-${streak}`} wajib surat.`
        );
      }
      if (row.st === 'I' && !row.leaveTime.trim()) {
        errors.push(`${s.n}: keterangan waktu izin wajib diisi.`);
      }
    });

    if (errors.length) {
      const msg = errors.join(' | ');
      setInputFeedback({ text: msg, bad: true });
      showToast(msg, true);
      return;
    }

    const nextMonths: MonthMap = structuredClone(months);
    const touched = new Set<string>();
    let missingCount = 0;

    rowsToSave.forEach(({ s, row }) => {
      const streak =
        row.st === 'S' ? consecutiveSickDays(nextMonths, s.id, inputDate) + 1 : 0;
      const prevExtra = getExtra(nextMonths, s.id, inputDate);
      const extra: ExtraEntry = {};
      if (row.note) extra.n = row.note;
      if (row.st === 'I' && row.leaveTime.trim()) {
        extra.tm = row.leaveTime.trim().slice(0, 20);
      }

      if (needsLetter(row.st, streak)) {
        if (row.doc) {
          extra.ds =
            prevExtra.ds === 'VERIFIED' && prevExtra.p === row.doc.pid
              ? 'VERIFIED'
              : 'UPLOADED';
          extra.p = row.doc.pid;
          extra.k = row.doc.k;
          extra.nm = row.doc.n;
          extra.o = row.doc.o;
        } else {
          extra.ds = 'MISSING';
          missingCount++;
        }
      }
      touched.add(putAttendance(nextMonths, s.id, inputDate, row.st, extra));
    });

    setMonths(nextMonths);
    stateRef.current = { ...stateRef.current, months: nextMonths };
    markDirty([...touched]);

    const okMsg =
      `Tersimpan: ${rowsToSave.length} siswa.` +
      (missingCount ? ` ${missingCount} surat menyusul masuk daftar peringatan.` : '');
    setInputFeedback({ text: okMsg, bad: false });
    showToast(okMsg);
  };

  const loadPhotoFromStorage = useCallback(
    async (pid: string): Promise<string | null> => {
      if (photoCache[pid]) return photoCache[pid];
      if (!currentUser) return null;
      try {
        const dataUrl = await loadPhotoFromFirestore(currentUser.uid, pid);
        if (!dataUrl) return null;
        setPhotoCache((prev) => ({ ...prev, [pid]: dataUrl }));
        return dataUrl;
      } catch {
        return null;
      }
    },
    [currentUser, photoCache]
  );

  const handlePreviewPhoto = async (pid: string | undefined, caption: string) => {
    if (!pid) {
      setPreviewPhoto({ src: PHOTO_PLACEHOLDER, caption });
      return;
    }
    const cached = photoCache[pid] || (await loadPhotoFromStorage(pid));
    setPreviewPhoto({ src: cached || PHOTO_PLACEHOLDER, caption });
  };

  const handleUploadFollowUp = async (entryKey: string, file: File) => {
    if (!currentUser) return;
    try {
      const compressed = await compressImageFile(file);
      const pid =
        'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await savePhotoToFirestore(currentUser.uid, pid, compressed.u);
      setPhotoCache((prev) => ({ ...prev, [pid]: compressed.u }));

      const [sidStr, dateStr] = entryKey.split('|');
      const nextMonths: MonthMap = structuredClone(months);
      const curStatus = getStatus(nextMonths, sidStr, dateStr);
      const curExtra = getExtra(nextMonths, sidStr, dateStr);
      const mKey = putAttendance(nextMonths, sidStr, dateStr, curStatus, {
        ...curExtra,
        ds: 'UPLOADED',
        p: pid,
        k: compressed.k,
        nm: compressed.n,
        o: compressed.o,
      });

      setMonths(nextMonths);
      stateRef.current = { ...stateRef.current, months: nextMonths };
      markDirty(mKey);
      showToast(`Foto surat dikompresi & diunggah (${compressed.k} KB).`);
    } catch {
      showToast(
        'Gagal memproses foto. Pilih file JPG, PNG, atau WebP lalu coba lagi.',
        true
      );
    }
  };

  const handleVerifyLetter = (entryKey: string) => {
    const [sidStr, dateStr] = entryKey.split('|');
    const nextMonths: MonthMap = structuredClone(months);
    const curStatus = getStatus(nextMonths, sidStr, dateStr);
    const curExtra = getExtra(nextMonths, sidStr, dateStr);
    const mKey = putAttendance(nextMonths, sidStr, dateStr, curStatus, {
      ...curExtra,
      ds: 'VERIFIED',
    });
    setMonths(nextMonths);
    stateRef.current = { ...stateRef.current, months: nextMonths };
    markDirty(mKey);
    showToast('Surat ditandai terverifikasi.');
  };

  // Master Data CRUD handlers
  const updateCore = (mutator: (draft: CoreData) => string | void) => {
    const nextCore: CoreData = structuredClone(core);
    const error = mutator(nextCore);
    if (error) {
      showToast(error, true);
      return;
    }
    setCore(nextCore);
    stateRef.current = { ...stateRef.current, core: nextCore };
    markDirty('core');
  };

  const handleAddStudent = (
    name: string,
    nis: string,
    className: string,
    gender: string
  ) => {
    const cleanName = name.trim();
    const cleanClass = className.trim();
    if (!cleanName || !cleanClass) {
      showToast('Isi nama siswa dan nama kelas.', true);
      return;
    }
    updateCore((d) => {
      const finalNis = nis.trim() || generateAutoNis(d);
      if (d.st.some((s) => s.nis === finalNis)) {
        return `NIS ${finalNis} sudah dipakai.`;
      }
      const cls = ensureClass(d, cleanClass);
      const g = gender === 'L' || gender === 'P' ? gender : inferGender(cls.n);
      d.st.push({ id: d.q++, n: cleanName, nis: finalNis, g, c: cls.id });
    });
    if (cleanName && cleanClass) showToast('Siswa ditambahkan.');
  };

  const handleBulkAddStudents = (
    className: string,
    waliName: string,
    text: string
  ) => {
    const cleanClass = className.trim();
    const rows = text
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!cleanClass || !rows.length) {
      showToast('Isi nama kelas dan daftar siswa.', true);
      return;
    }

    let ok = 0;
    let skipped = 0;
    updateCore((d) => {
      const cls = ensureClass(d, cleanClass);
      if (waliName.trim()) cls.w = ensureTeacher(d, waliName.trim()).id;
      rows.forEach((line) => {
        let [n, nis, g] = parseBulkLine(line);
        if (nis && /^[LP]$/i.test(nis)) {
          g = nis;
          nis = '';
        }
        const finalNis = nis || generateAutoNis(d);
        if (!n || d.st.some((s) => s.nis === finalNis)) {
          skipped++;
          return;
        }
        const finalGender = /^[LP]$/i.test(g || '')
          ? (g.toUpperCase() as 'L' | 'P')
          : inferGender(cls.n);
        d.st.push({
          id: d.q++,
          n,
          nis: finalNis,
          g: finalGender,
          c: cls.id,
        });
        ok++;
      });
    });
    showToast(
      `${ok} siswa ditambahkan ke ${cleanClass}.` +
        (skipped ? ` ${skipped} baris dilewati.` : '')
    );
  };

  const handleSaveEditedStudent = (
    studentId: number,
    updates: { n: string; nis: string; c: number; g: 'L' | 'P' | '' }
  ) => {
    updateCore((d) => {
      const st = d.st.find((x) => x.id === studentId);
      if (!st) return;
      st.n = updates.n;
      st.nis = updates.nis;
      st.c = updates.c;
      st.g = updates.g;
    });
    setEditingStudent(null);
    showToast('Data siswa diperbarui.');
  };

  const handleDeleteStudent = (studentId: number) => {
    const nextCore: CoreData = structuredClone(core);
    nextCore.st = nextCore.st.filter((s) => s.id !== studentId);
    const nextMonths: MonthMap = structuredClone(months);
    const touchedMonths = purgeStudentAttendance(nextMonths, studentId);

    setCore(nextCore);
    setMonths(nextMonths);
    stateRef.current = { ...stateRef.current, core: nextCore, months: nextMonths };
    markDirty(['core', ...touchedMonths]);
    showToast('Data siswa berhasil dihapus.');
  };

  const handleAddTeacher = (name: string, nip: string, className: string) => {
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('Isi nama guru.', true);
      return;
    }
    updateCore((d) => {
      const t = ensureTeacher(d, cleanName, nip.trim());
      if (nip.trim()) t.nip = nip.trim();
      if (className.trim()) ensureClass(d, className.trim()).w = t.id;
    });
    showToast('Guru ditambahkan.');
  };

  const handleBulkAddTeachers = (text: string) => {
    const rows = text
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!rows.length) {
      showToast('Isi daftar guru.', true);
      return;
    }
    updateCore((d) => {
      rows.forEach((line) => {
        const [n, nip, clsName] = parseBulkLine(line);
        if (!n) return;
        const t = ensureTeacher(d, n, nip);
        if (nip) t.nip = nip;
        if (clsName) ensureClass(d, clsName).w = t.id;
      });
    });
    showToast(`${rows.length} baris guru diproses.`);
  };

  const handleDeleteTeacher = (teacherId: number) => {
    updateCore((d) => {
      d.t = d.t.filter((t) => t.id !== teacherId);
      d.c.forEach((c) => {
        if (c.w === teacherId) c.w = null;
      });
    });
    showToast('Data guru berhasil dihapus.');
  };

  const handleRenameClass = (classId: number, rawName: string) => {
    const clean = rawName.trim().replace(/\s+/g, ' ');
    if (!clean) return;
    if (
      core.c.some(
        (o) => o.id !== classId && normalizeText(o.n) === normalizeText(clean)
      )
    ) {
      showToast('Nama kelas sudah dipakai.', true);
      return;
    }
    updateCore((d) => {
      const cls = d.c.find((c) => c.id === classId);
      if (cls) cls.n = clean;
    });
    showToast('Nama kelas diperbarui.');
  };

  const handleChangeClassWali = (classId: number, rawWali: string) => {
    const clean = rawWali.trim();
    updateCore((d) => {
      const cls = d.c.find((c) => c.id === classId);
      if (!cls) return;
      cls.w = clean ? ensureTeacher(d, clean).id : null;
    });
    showToast('Wali kelas diperbarui.');
  };

  const handleDeleteClass = (classId: number) => {
    updateCore((d) => {
      d.c = d.c.filter((c) => c.id !== classId);
    });
    showToast('Kelas berhasil dihapus.');
  };

  const handleUpdateSettingField = (path: string, value: string) => {
    updateCore((d) => {
      const [key, sub] = path.split('.');
      if (sub === 'n' || sub === 'nip') {
        const target = d.s[key as 'kepsek' | 'wakasek' | 'ikhwan' | 'akhwat'];
        target[sub] = value;
      } else {
        (d.s[key as 'nama' | 'alamat' | 'kota' | 'tahun'] as string) = value;
      }
    });
  };

  if (!ready) {
    return (
      <div className="max-w-[1160px] mx-auto px-5 py-12 text-sm text-[var(--mu)]">
        Memuat aplikasi...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        mode={authMode}
        error={authError}
        notice={authNotice}
        theme={theme}
        isOnline={isOnline}
        pendingVerificationEmail={pendingVerificationEmail}
        onToggleMode={() => {
          setAuthMode((m) => (m === 'reg' ? 'in' : 'reg'));
          setAuthError('');
          setAuthNotice('');
        }}
        onCycleTheme={cycleTheme}
        onSubmit={handleAuthSubmit}
        onGoogleLogin={handleGoogleLogin}
        onResetPassword={handleResetPassword}
        onCheckVerification={handleCheckVerification}
        onResendVerification={handleResendVerification}
        onCancelVerification={handleCancelVerification}
      />
    );
  }

  const missingCount = getMissingDocs(months).length;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header
        schoolName={core.s.nama}
        schoolYear={core.s.tahun}
        email={email}
        activeTab={activeTab}
        missingCount={missingCount}
        isOnline={isOnline}
        saveStatus={saveStatus}
        theme={theme}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'input') {
            setDrafts({});
            setInputFeedback(null);
          }
        }}
        onCycleTheme={cycleTheme}
        onLogout={() => void handleLogout()}
        pwa={pwa}
      />

      <main className="max-w-[1160px] mx-auto px-4 sm:px-5 py-6 pb-16">
        {activeTab === 'dash' && (
          <DashboardView
            core={core}
            months={months}
            todayStr={todayStr}
            onNavigateTab={setActiveTab}
            onQuickInputClass={(classId) => {
              setInputClassId(classId);
              setDrafts({});
              setInputFeedback(null);
              setActiveTab('input');
            }}
            onLoadSeed={handleLoadSeed}
          />
        )}

        {activeTab === 'input' && (
          <InputView
            core={core}
            months={months}
            todayStr={todayStr}
            selectedClassId={effectiveInputClassId}
            selectedDate={inputDate}
            drafts={drafts}
            feedback={inputFeedback}
            onChangeClass={(cid) => {
              setInputClassId(cid);
              setDrafts({});
              setInputFeedback(null);
            }}
            onChangeDate={(dt) => {
              setInputDate(dt);
              setDrafts({});
              setInputFeedback(null);
            }}
            onSelectStatus={handleSelectStatus}
            onChangeNote={handleChangeNote}
            onChangeLeaveTime={handleChangeLeaveTime}
            onToggleDefer={handleToggleDefer}
            onUploadPhoto={handleUploadInputPhoto}
            onFillAllPresent={handleFillAllPresent}
            onSave={handleSaveAttendance}
            onNavigateTab={setActiveTab}
            onPreviewPhoto={(pid, caption) => void handlePreviewPhoto(pid, caption)}
          />
        )}

        {activeTab === 'surat' && (
          <SuratView
            core={core}
            months={months}
            photoCache={photoCache}
            onLoadPhoto={loadPhotoFromStorage}
            onUploadFollowUp={handleUploadFollowUp}
            onVerify={handleVerifyLetter}
            onPreviewPhoto={(pid, caption) => void handlePreviewPhoto(pid, caption)}
          />
        )}

        {activeTab === 'data' && (
          <DataView
            core={core}
            onAddStudent={handleAddStudent}
            onBulkAddStudents={handleBulkAddStudents}
            onEditStudent={setEditingStudent}
            onDeleteStudent={handleDeleteStudent}
            onAddTeacher={handleAddTeacher}
            onBulkAddTeachers={handleBulkAddTeachers}
            onDeleteTeacher={handleDeleteTeacher}
            onRenameClass={handleRenameClass}
            onChangeClassWali={handleChangeClassWali}
            onDeleteClass={handleDeleteClass}
          />
        )}

        {activeTab === 'rekap' && (
          <RekapView
            core={core}
            months={months}
            todayStr={todayStr}
            onNotify={showToast}
          />
        )}

        {activeTab === 'set' && (
          <SettingsView
            settings={core.s}
            theme={theme}
            onUpdateField={handleUpdateSettingField}
            onCycleTheme={cycleTheme}
          />
        )}
      </main>

      <PhotoPreviewModal
        open={Boolean(previewPhoto)}
        src={previewPhoto?.src || ''}
        caption={previewPhoto?.caption || ''}
        onClose={() => setPreviewPhoto(null)}
      />

      <EditStudentModal
        student={editingStudent}
        classes={core.c}
        existingStudents={core.st}
        onClose={() => setEditingStudent(null)}
        onSave={handleSaveEditedStudent}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`no-print fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-sm z-50 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl ${
            toast.bad ? 'bg-[var(--a-btn)] text-white' : 'bg-[var(--h-btn)] text-white'
          }`}
        >
          {toast.text}
        </div>
      )}

      <PWAPromptModal
        open={pwa.isPopupOpen}
        isInstallable={pwa.isInstallable}
        platform={pwa.platform}
        inIframe={pwa.inIframe}
        onInstall={pwa.install}
        onClose={pwa.closePopup}
      />
    </div>
  );
}
