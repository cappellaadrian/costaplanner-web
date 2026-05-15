import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Costaplanner — Diseño estructural Costa Rica",
  description:
    "Diseña vigas, columnas, zapatas y losas conforme al CSCR-10 Rev. 2014 + ACI 318-14. Cada ecuación a la vista, citada al código, verificada en vivo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CR">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
