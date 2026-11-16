import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan saat memuat aplikasi.',
    };
  }

  componentDidCatch(error: Error): void {
    console.error('App render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center bg-[#f3f6fa] text-[#0f243e] p-6">
          <div className="w-full max-w-md rounded-2xl border border-[#dce4ee] bg-white p-6 shadow-lg space-y-3">
            <h1 className="text-lg font-extrabold">Gagal Memuat SIMS Absensi</h1>
            <p className="text-sm text-[#5c6f84] leading-relaxed">
              Terjadi kendala saat menampilkan halaman. Silakan muat ulang halaman atau bersihkan cache browser.
            </p>
            {this.state.message && (
              <pre className="rounded-lg bg-[#f8fafc] border border-[#e8eef5] p-3 text-xs text-[#dc2626] overflow-x-auto whitespace-pre-wrap">
                {this.state.message}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-lg bg-[#1d4ed8] text-white px-4 py-2.5 text-sm font-semibold hover:brightness-105 cursor-pointer"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
