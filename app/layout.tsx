import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'QUOTTA Club | Liberdade compartilhada', description: 'Cotas compartilhadas de jet skis, lanchas e carros. Conheça o Sea-Doo Wake 170 2026 em Guarapari.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="pt-BR"><body>{children}</body></html>; }
