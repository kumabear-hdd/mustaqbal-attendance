import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  ClassRoom,
  CoreData,
  MonthData,
  MonthMap,
  SchoolSettings,
  Student,
  Teacher,
} from '../types/sims';
import { createEmptyCoreData } from './simsLogic';

const SCHEDULE_STORAGE_PREFIX = 'sims_schedule_';

function loadLocalSchedule(uid: string): { startTime?: string; graceMinutes?: number } {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(`${SCHEDULE_STORAGE_PREFIX}${uid}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { startTime?: unknown; graceMinutes?: unknown };
    const startTime =
      typeof parsed.startTime === 'string' && /^\d{2}:\d{2}$/.test(parsed.startTime)
        ? parsed.startTime
        : undefined;
    const graceNum = Number(parsed.graceMinutes);
    const graceMinutes = Number.isFinite(graceNum)
      ? Math.max(0, Math.min(60, Math.floor(graceNum)))
      : undefined;
    return { startTime, graceMinutes };
  } catch {
    return {};
  }
}

export function saveLocalSchedule(uid: string, s: SchoolSettings): void {
  try {
    if (typeof localStorage === 'undefined' || !uid) return;
    const rawStart = String(s?.startTime ?? '07:00').trim();
    const startTime = /^\d{2}:\d{2}$/.test(rawStart) ? rawStart : '07:00';
    const rawGrace = Number(s?.graceMinutes);
    const graceMinutes = Number.isFinite(rawGrace)
      ? Math.max(0, Math.min(60, Math.floor(rawGrace)))
      : 5;
    localStorage.setItem(
      `${SCHEDULE_STORAGE_PREFIX}${uid}`,
      JSON.stringify({ startTime, graceMinutes })
    );
  } catch {
    // Ignore storage restrictions
  }
}

function sanitizeCloudSchoolSettings(s: SchoolSettings): Omit<SchoolSettings, 'startTime' | 'graceMinutes'> {
  const cleanPerson = (p?: { n?: string; nip?: string }) => ({
    n: String(p?.n ?? '').slice(0, 120),
    nip: String(p?.nip ?? '').slice(0, 40),
  });
  return {
    nama: String(s?.nama ?? '').slice(0, 160),
    alamat: String(s?.alamat ?? '').slice(0, 300),
    kota: String(s?.kota ?? '').slice(0, 100),
    tahun: String(s?.tahun ?? '').slice(0, 60),
    kepsek: cleanPerson(s?.kepsek),
    wakasek: cleanPerson(s?.wakasek),
    ikhwan: cleanPerson(s?.ikhwan),
    akhwat: cleanPerson(s?.akhwat),
  };
}

function hydrateSchoolSettings(s: SchoolSettings, uid: string): SchoolSettings {
  const cloud = sanitizeCloudSchoolSettings(s);
  const local = loadLocalSchedule(uid);
  const rawStart = String(s?.startTime ?? local.startTime ?? '07:00').trim();
  const startTime = /^\d{2}:\d{2}$/.test(rawStart) ? rawStart : '07:00';
  const rawGrace = s?.graceMinutes ?? local.graceMinutes ?? 5;
  const graceMinutes = Number.isFinite(Number(rawGrace))
    ? Math.max(0, Math.min(60, Math.floor(Number(rawGrace))))
    : 5;
  return {
    ...cloud,
    startTime,
    graceMinutes,
  };
}

function sanitizeClassRoom(c: ClassRoom): ClassRoom {
  return {
    id: Math.max(1, Math.floor(Number(c.id))),
    n: (String(c.n ?? '').trim() || 'Kelas').slice(0, 80),
    w: c.w && Number(c.w) >= 1 ? Math.floor(Number(c.w)) : null,
  };
}

function sanitizeTeacher(t: Teacher): Teacher {
  return {
    id: Math.max(1, Math.floor(Number(t.id))),
    n: (String(t.n ?? '').trim() || 'Guru').slice(0, 120),
    nip: String(t.nip ?? '').slice(0, 40),
  };
}

function sanitizeStudent(st: Student): Student {
  const g = st.g === 'L' || st.g === 'P' ? st.g : '';
  return {
    id: Math.max(1, Math.floor(Number(st.id))),
    n: (String(st.n ?? '').trim() || 'Siswa').slice(0, 120),
    nis: (String(st.nis ?? '').trim() || String(st.id)).slice(0, 40),
    g,
    c: Math.max(0, Math.floor(Number(st.c) || 0)),
  };
}

interface UserProfileDoc {
  uid: string;
  email: string;
  s: SchoolSettings;
  q: number;
  demo?: number;
}

export interface LoadedSchoolState {
  core: CoreData;
  months: MonthMap;
  knownMonthKeys: Set<string>;
}

export async function loadSchoolDataFromFirestore(
  uid: string,
  email: string
): Promise<LoadedSchoolState> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let profileData: UserProfileDoc | null = null;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      profileData = snap.data() as UserProfileDoc;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!profileData) {
    const empty = createEmptyCoreData();
    const cleanSettings = sanitizeCloudSchoolSettings(empty.s);
    try {
      await setDoc(userRef, {
        uid,
        email: email.slice(0, 254),
        s: cleanSettings,
        q: 1,
        demo: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
    return {
      core: {
        ...empty,
        s: hydrateSchoolSettings(empty.s, uid),
      },
      months: {},
      knownMonthKeys: new Set(),
    };
  }

  const classesPath = `users/${uid}/classes`;
  const teachersPath = `users/${uid}/teachers`;
  const studentsPath = `users/${uid}/students`;
  const monthsPath = `users/${uid}/months`;

  const [classesSnap, teachersSnap, studentsSnap, monthsSnap] = await Promise.all([
    getDocs(query(collection(db, classesPath), where('ownerId', '==', uid))).catch((e) =>
      handleFirestoreError(e, OperationType.LIST, classesPath)
    ),
    getDocs(query(collection(db, teachersPath), where('ownerId', '==', uid))).catch((e) =>
      handleFirestoreError(e, OperationType.LIST, teachersPath)
    ),
    getDocs(query(collection(db, studentsPath), where('ownerId', '==', uid))).catch((e) =>
      handleFirestoreError(e, OperationType.LIST, studentsPath)
    ),
    getDocs(query(collection(db, monthsPath), where('ownerId', '==', uid))).catch((e) =>
      handleFirestoreError(e, OperationType.LIST, monthsPath)
    ),
  ]);

  const c: ClassRoom[] = classesSnap.docs
    .map((d) => {
      const data = d.data() as ClassRoom;
      return { id: data.id, n: data.n, w: data.w ?? null };
    })
    .sort((a, b) => a.id - b.id);

  const t: Teacher[] = teachersSnap.docs
    .map((d) => {
      const data = d.data() as Teacher;
      return { id: data.id, n: data.n, nip: data.nip || '' };
    })
    .sort((a, b) => a.id - b.id);

  const st: Student[] = studentsSnap.docs
    .map((d) => {
      const data = d.data() as Student;
      const g: Student['g'] = data.g === 'L' || data.g === 'P' ? data.g : '';
      return {
        id: data.id,
        n: data.n,
        nis: data.nis,
        g,
        c: data.c,
      };
    })
    .sort((a, b) => a.id - b.id);

  const months: MonthMap = {};
  const knownMonthKeys = new Set<string>();
  monthsSnap.docs.forEach((d) => {
    const data = d.data() as MonthData & { ym?: string };
    const ym = data.ym || d.id;
    months[ym] = { a: data.a || {}, x: data.x || {} };
    knownMonthKeys.add(ym);
  });

  const core: CoreData = {
    s: hydrateSchoolSettings(profileData.s, uid),
    c,
    t,
    st,
    q: Math.max(1, Number(profileData.q) || 1),
    ...(profileData.demo ? { demo: profileData.demo } : {}),
  };

  return { core, months, knownMonthKeys };
}

type BatchOp = (batch: WriteBatch) => void;

async function commitBatchOps(ops: BatchOp[], opPath: string): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    const slice = ops.slice(i, i + CHUNK_SIZE);
    slice.forEach((fn) => fn(batch));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, opPath);
    }
  }
}

export async function syncDirtyToFirestore(params: {
  uid: string;
  prevCore: CoreData;
  nextCore: CoreData;
  nextMonths: MonthMap;
  knownMonthKeys: Set<string>;
  dirtyKeys: string[];
}): Promise<void> {
  const { uid, prevCore, nextCore, nextMonths, knownMonthKeys, dirtyKeys } = params;
  const ops: BatchOp[] = [];

  if (dirtyKeys.includes('core')) {
    saveLocalSchedule(uid, nextCore.s);
    const userRef = doc(db, 'users', uid);
    const prevCloudSettings = sanitizeCloudSchoolSettings(prevCore.s);
    const cleanSettings = sanitizeCloudSchoolSettings(nextCore.s);
    const nextDemo = nextCore.demo ? 1 : 0;

    if (
      JSON.stringify(prevCloudSettings) !== JSON.stringify(cleanSettings) ||
      prevCore.q !== nextCore.q ||
      (prevCore.demo || 0) !== nextDemo
    ) {
      ops.push((batch) =>
        batch.update(userRef, {
          s: cleanSettings,
          q: Math.max(1, Math.floor(Number(nextCore.q) || 1)),
          demo: nextDemo,
          updatedAt: serverTimestamp(),
        })
      );
    }

    // Diff classes
    const prevClasses = new Map(prevCore.c.map((x) => [x.id, x]));
    const nextClasses = new Map(nextCore.c.map((x) => [x.id, sanitizeClassRoom(x)]));
    for (const [id, cls] of nextClasses) {
      const prev = prevClasses.get(id);
      const ref = doc(db, 'users', uid, 'classes', String(id));
      if (!prev) {
        ops.push((batch) =>
          batch.set(ref, {
            ownerId: uid,
            id: cls.id,
            n: cls.n,
            w: cls.w,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } else if (prev.n !== cls.n || (prev.w ?? null) !== (cls.w ?? null)) {
        ops.push((batch) =>
          batch.update(ref, {
            n: cls.n,
            w: cls.w,
            updatedAt: serverTimestamp(),
          })
        );
      }
    }
    for (const id of prevClasses.keys()) {
      if (!nextClasses.has(id)) {
        ops.push((batch) => batch.delete(doc(db, 'users', uid, 'classes', String(id))));
      }
    }

    // Diff teachers
    const prevTeachers = new Map(prevCore.t.map((x) => [x.id, x]));
    const nextTeachers = new Map(nextCore.t.map((x) => [x.id, sanitizeTeacher(x)]));
    for (const [id, teacher] of nextTeachers) {
      const prev = prevTeachers.get(id);
      const ref = doc(db, 'users', uid, 'teachers', String(id));
      if (!prev) {
        ops.push((batch) =>
          batch.set(ref, {
            ownerId: uid,
            id: teacher.id,
            n: teacher.n,
            nip: teacher.nip,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } else if (prev.n !== teacher.n || prev.nip !== teacher.nip) {
        ops.push((batch) =>
          batch.update(ref, {
            n: teacher.n,
            nip: teacher.nip,
            updatedAt: serverTimestamp(),
          })
        );
      }
    }
    for (const id of prevTeachers.keys()) {
      if (!nextTeachers.has(id)) {
        ops.push((batch) => batch.delete(doc(db, 'users', uid, 'teachers', String(id))));
      }
    }

    // Diff students
    const prevStudents = new Map(prevCore.st.map((x) => [x.id, x]));
    const nextStudents = new Map(nextCore.st.map((x) => [x.id, sanitizeStudent(x)]));
    for (const [id, student] of nextStudents) {
      const prev = prevStudents.get(id);
      const ref = doc(db, 'users', uid, 'students', String(id));
      if (!prev) {
        ops.push((batch) =>
          batch.set(ref, {
            ownerId: uid,
            id: student.id,
            n: student.n,
            nis: student.nis,
            g: student.g,
            c: student.c,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } else if (
        prev.n !== student.n ||
        prev.nis !== student.nis ||
        prev.g !== student.g ||
        prev.c !== student.c
      ) {
        ops.push((batch) =>
          batch.update(ref, {
            n: student.n,
            nis: student.nis,
            g: student.g,
            c: student.c,
            updatedAt: serverTimestamp(),
          })
        );
      }
    }
    for (const id of prevStudents.keys()) {
      if (!nextStudents.has(id)) {
        ops.push((batch) => batch.delete(doc(db, 'users', uid, 'students', String(id))));
      }
    }
  }

  for (const key of dirtyKeys) {
    if (!key.startsWith('m-')) continue;
    const ym = key.slice(2);
    const monthPayload = nextMonths[ym] || { a: {}, x: {} };
    const monthRef = doc(db, 'users', uid, 'months', ym);

    if (knownMonthKeys.has(ym)) {
      ops.push((batch) =>
        batch.update(monthRef, {
          a: monthPayload.a || {},
          x: monthPayload.x || {},
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      let alreadyExists = false;
      try {
        const snap = await getDoc(monthRef);
        alreadyExists = snap.exists();
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${uid}/months/${ym}`);
      }
      if (alreadyExists) {
        knownMonthKeys.add(ym);
        ops.push((batch) =>
          batch.update(monthRef, {
            a: monthPayload.a || {},
            x: monthPayload.x || {},
            updatedAt: serverTimestamp(),
          })
        );
      } else {
        ops.push((batch) =>
          batch.set(monthRef, {
            ownerId: uid,
            ym,
            a: monthPayload.a || {},
            x: monthPayload.x || {},
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        knownMonthKeys.add(ym);
      }
    }
  }

  if (ops.length > 0) {
    await commitBatchOps(ops, `users/${uid}`);
  }
}

export async function savePhotoToFirestore(
  uid: string,
  pid: string,
  dataUrl: string
): Promise<void> {
  if (dataUrl.length > 350000) {
    throw new Error('Ukuran gambar melebihi batas maksimal 350 KB.');
  }
  const photoPath = `users/${uid}/photos/${pid}`;
  const ref = doc(db, 'users', uid, 'photos', pid);
  try {
    await setDoc(ref, {
      ownerId: uid,
      pid: pid.slice(0, 64),
      u: dataUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, photoPath);
  }
}

export async function loadPhotoFromFirestore(
  uid: string,
  pid: string
): Promise<string | null> {
  const photoPath = `users/${uid}/photos/${pid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'photos', pid));
    if (!snap.exists()) return null;
    const data = snap.data() as { u?: string };
    return data.u || null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, photoPath);
  }
}

// Keep unused imports check clean if needed
export { deleteDoc, updateDoc };
