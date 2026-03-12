"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
      <div className="bg-surface p-8 rounded-sds-200 shadow-lg w-full max-w-md">
        <h1 className="text-title-page font-semibold text-text-primary mb-6">
          Symmetry Debugger
        </h1>
        <p className="text-body-small text-text-secondary mb-8">
          Sign in with your operator credentials
        </p>
        {error && (
          <div className="bg-status-error-light text-status-error p-3 rounded-sds-100 mb-4 text-body-small">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-body-small text-text-secondary mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-sds-100 text-body-base focus:outline-none focus:ring-2 focus:ring-brand-blue"
              required
            />
          </div>
          <div>
            <label className="block text-body-small text-text-secondary mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-sds-100 text-body-base focus:outline-none focus:ring-2 focus:ring-brand-blue"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-brand-blue text-white rounded-sds-100 font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
