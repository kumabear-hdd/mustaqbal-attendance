import React from 'react';
import { Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import type { SchoolSettings, ThemeMode } from '../types/sims';

interface SettingsViewProps {
  settings: SchoolSettings;
  theme: ThemeMode;
  onUpdateField: (path: string, value: string) => void;
  onCycleTheme: () => void;
}

const themeLabels: Record<ThemeMode, string> = {
  auto: 'Tema: Otomatis',
  light: 'Tema: Terang',
  dark: 'Tema: Gelap',
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  theme,
  onUpdateField,
  onCycleTheme,
}) => {
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  const renderInput = (label: string, path: string, value: string) => (
    <label className="text-xs font-semibold text-[var(--mu)]">
      {label}
      <input
        value={value}
        onChange={(e) => onUpdateField(path, e.target.value)}
        className="mt-1 w-full min-h-[38px] rounded-lg border border-[var(--ln)] bg-[var(--sf)] px-3 py-1.5 text-sm text-[var(--ink)] font-medium focus:outline-none focus:border-[var(--pri)]"
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Pengaturan Sekolah
        </h1>
        <p className="text-sm text-[var(--mu)]">
          Perubahan tersimpan otomatis dan digunakan pada kop serta lembar
          pengesahan laporan rekap.
        </p>
      </div>

      <section className="bg-[var(--sf)] border border-[var(--ln)] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <h2 className="text-base font-bold">Identitas Sekolah</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {renderInput('Nama sekolah', 'nama', settings.nama)}
          {renderInput('Alamat lengkap', 'alamat', settings.alamat)}
          {renderInput(
            'Tahun ajaran (contoh: 2026/2027 Ganjil)',
            'tahun',
            settings.tahun
          )}
          {renderInput(
            'Kota / Kabupaten (untuk tanggal pengesahan)',
            'kota',
            settings.kota
          )}
        </div>
      </section>

      <section className="bg-[var(--sf)] border border-[var(--ln)] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <h2 className="text-base font-bold">Waktu Masuk &amp; Kompensasi Telat</h2>
        <p className="text-xs text-[var(--mu)]">
          Siswa yang hadir melewati jam masuk ditambah toleransi kompensasi akan otomatis tercatat sebagai <strong>Hadir (Telat)</strong>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <label className="text-xs font-semibold text-[var(--mu)]">
            Jam Masuk Sekolah (contoh: 07:00)
            <input
              type="time"
              value={settings.startTime || '07:00'}
              onChange={(e) => onUpdateField('startTime', e.target.value)}
              className="mt-1 w-full min-h-[38px] rounded-lg border border-[var(--ln)] bg-[var(--sf)] px-3 py-1.5 text-sm text-[var(--ink)] font-mono-num font-medium focus:outline-none focus:border-[var(--pri)]"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--mu)]">
            Kompensasi Telat (menit)
            <input
              type="number"
              min="0"
              max="60"
              value={settings.graceMinutes ?? 5}
              onChange={(e) => onUpdateField('graceMinutes', e.target.value)}
              className="mt-1 w-full min-h-[38px] rounded-lg border border-[var(--ln)] bg-[var(--sf)] px-3 py-1.5 text-sm text-[var(--ink)] font-mono-num font-medium focus:outline-none focus:border-[var(--pri)]"
            />
          </label>
        </div>
      </section>

      <section className="bg-[var(--sf)] border border-[var(--ln)] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <h2 className="text-base font-bold">Penandatangan Laporan Rekap</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {renderInput('Nama Kepala Sekolah', 'kepsek.n', settings.kepsek.n)}
          {renderInput('NIP Kepala Sekolah', 'kepsek.nip', settings.kepsek.nip)}
          {renderInput('Nama Wakil Kesiswaan', 'wakasek.n', settings.wakasek.n)}
          {renderInput('NIP Wakil Kesiswaan', 'wakasek.nip', settings.wakasek.nip)}
          {renderInput(
            'Nama Koordinator / Wali Kelas Ikhwan',
            'ikhwan.n',
            settings.ikhwan.n
          )}
          {renderInput(
            'NIP Koordinator / Wali Kelas Ikhwan',
            'ikhwan.nip',
            settings.ikhwan.nip
          )}
          {renderInput(
            'Nama Koordinator / Wali Kelas Akhwat',
            'akhwat.n',
            settings.akhwat.n
          )}
          {renderInput(
            'NIP Koordinator / Wali Kelas Akhwat',
            'akhwat.nip',
            settings.akhwat.nip
          )}
        </div>
      </section>

      <section className="bg-[var(--sf)] border border-[var(--ln)] rounded-xl p-4 sm:p-5 shadow-sm">
        <h2 className="text-base font-bold mb-2">Tampilan &amp; Keamanan</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-[var(--mu)]">
            <ShieldCheck className="w-4 h-4 text-[var(--h)] shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Akun terlindungi oleh <strong>Firebase Authentication</strong> dan
              seluruh data absensi tersinkron aman di <strong>Cloud Firestore</strong>{' '}
              untuk akses lintas perangkat.
            </span>
          </div>
          <button
            type="button"
            onClick={onCycleTheme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ln)] bg-[var(--sf2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--mu)] transition cursor-pointer whitespace-nowrap"
          >
            <ThemeIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{themeLabels[theme]}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
