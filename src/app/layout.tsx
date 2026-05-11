import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";

export const metadata: Metadata = {
  title: "QGuard — Quantum-Safe Cybersecurity Platform",
  description: "The world's first consumer quantum cybersecurity companion. Scan for quantum vulnerabilities, migrate to post-quantum cryptography, and protect your digital life against Q-Day.",
  keywords: "quantum security, post-quantum cryptography, Q-Day protection, PQC vault, quantum key generator, HNDL protection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
