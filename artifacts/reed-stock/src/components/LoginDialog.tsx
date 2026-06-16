import { useState } from "react";
import { useAuth } from "@/lib/auth";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LoginDialog({ open, onClose, onSuccess }: LoginDialogProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  if (!open) return null;

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Username dan password wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(username, password);
    setLoading(false);

    if (result.ok) {
      setUsername("");
      setPassword("");
      onSuccess?.();
      onClose();
    } else {
      setError(result.message || "Login gagal");
    }
  };

  const handleClose = () => {
    setUsername("");
    setPassword("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1e2a3a] border border-gray-700 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-xl">🔒</span>
            <h2 className="text-white font-semibold text-lg">Login Admin</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Masukkan username dan password untuk mengakses mode edit.
        </p>

        {/* Username */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full bg-[#111827] border border-gray-600 focus:border-green-500 outline-none rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm"
            autoFocus
          />
        </div>

        {/* Password */}
        <div className="mb-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full bg-[#111827] border border-gray-600 focus:border-green-500 outline-none rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mb-3">⚠ {error}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm transition"
          >
            Batal
          </button>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm transition"
          >
            {loading ? "Memverifikasi..." : "Masuk"}
          </button>
        </div>
      </div>
    </div>
  );
}