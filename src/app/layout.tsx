import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pyw31337.github.io"),
  title: "Culture Flow 서울 · 경기 · 인천 통합 공연 검색",
  description: "서울, 경기, 인천 지역의 모든 공연 정보를 한눈에 확인하세요.",
  openGraph: {
    title: "Culture Flow 서울 · 경기 · 인천 통합 공연 검색",
    description: "서울, 경기, 인천 지역의 모든 공연 정보를 한눈에 확인하세요.",
    images: [
      {
        url: "/culture/images/og-image.jpg",
        width: 1200,
        height: 600,
        alt: "Culture Flow Preview",
      },
    ],
    type: "website",
  },
  icons: {
    icon: '/culture/favicon.png',
    apple: '/culture/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
