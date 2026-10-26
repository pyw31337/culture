'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { Lock, KeyRound, ShieldCheck, ArrowLeft, LogOut, Eye, EyeOff, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

const ADMIN_PASSWORD_KEY = 'cf_admin_password';
const ADMIN_SESSION_KEY = 'cf_admin_authenticated';
const DEFAULT_INITIAL_PASSWORD = '0602';

interface AdminAuthGuardProps {
    children: ReactNode;
}

export default function AdminAuthGuard({ children }: AdminAuthGuardProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [inputPassword, setInputPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState('');

    // 비밀번호 변경 모달 관련 상태
    const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [changeError, setChangeError] = useState('');
    const [changeSuccess, setChangeSuccess] = useState('');

    const getStoredPassword = (): string => {
        if (typeof window === 'undefined') return DEFAULT_INITIAL_PASSWORD;
        return localStorage.getItem(ADMIN_PASSWORD_KEY) || DEFAULT_INITIAL_PASSWORD;
    };

    useEffect(() => {
        setIsMounted(true);
        const sessionAuth = sessionStorage.getItem(ADMIN_SESSION_KEY);
        if (sessionAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const currentValidPassword = getStoredPassword();
        if (inputPassword === currentValidPassword) {
            setIsAuthenticated(true);
            sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
            setLoginError('');
        } else {
            setLoginError('비밀번호가 올바르지 않습니다. 다시 입력해주세요.');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setInputPassword('');
        setLoginError('');
    };

    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault();
        setChangeError('');
        setChangeSuccess('');

        const currentValidPassword = getStoredPassword();
        if (currentPwd !== currentValidPassword) {
            setChangeError('현재 비밀번호가 일치하지 않습니다.');
            return;
        }

        if (!newPwd || newPwd.trim().length === 0) {
            setChangeError('새 비밀번호를 입력해주세요.');
            return;
        }

        if (newPwd !== confirmPwd) {
            setChangeError('새 비밀번호와 확인 입력이 일치하지 않습니다.');
            return;
        }

        localStorage.setItem(ADMIN_PASSWORD_KEY, newPwd);
        setChangeSuccess('비밀번호가 성공적으로 변경되었습니다!');
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');

        setTimeout(() => {
            setIsChangeModalOpen(false);
            setChangeSuccess('');
        }, 1200);
    };

    const handleResetToDefault = () => {
        if (window.confirm('비밀번호를 초기 비밀번호(0602)로 재설정하시겠습니까?')) {
            localStorage.setItem(ADMIN_PASSWORD_KEY, DEFAULT_INITIAL_PASSWORD);
            setChangeSuccess('비밀번호가 초기값(0602)으로 재설정되었습니다.');
            setCurrentPwd('');
            setNewPwd('');
            setConfirmPwd('');
            setChangeError('');
            setTimeout(() => {
                setIsChangeModalOpen(false);
                setChangeSuccess('');
            }, 1200);
        }
    };

    if (!isMounted) {
        return (
            <div className="min-h-screen bg-[#070b14] text-white flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c1427]/90 p-8 shadow-2xl backdrop-blur-xl">
                    <div className="flex flex-col items-center text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-inner mb-4">
                            <Lock className="h-8 w-8" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-white">관리자 인증</h1>
                        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                            Culture Flow 관리자 페이지입니다.<br />
                            계속하려면 비밀번호를 입력해주세요.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="mt-8 space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                                관리자 비밀번호
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={inputPassword}
                                    onChange={(e) => {
                                        setInputPassword(e.target.value);
                                        if (loginError) setLoginError('');
                                    }}
                                    placeholder="비밀번호를 입력하세요"
                                    autoFocus
                                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {loginError && (
                            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{loginError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-400 hover:to-blue-500 active:scale-[0.99]"
                        >
                            로그인
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                        <Link href="/" className="inline-flex items-center gap-1.5 hover:text-white transition">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            <span>홈으로 돌아가기</span>
                        </Link>
                        <span className="text-[11px] text-slate-500">Culture Flow Admin</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* 관리자 상단 툴바 */}
            <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b14]/90 backdrop-blur-md px-4 py-2.5">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            <ShieldCheck className="h-4 w-4" />
                        </span>
                        <div>
                            <span className="text-xs font-black tracking-wide text-white">Culture Flow Admin</span>
                            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                                인증됨
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setIsChangeModalOpen(true);
                                setChangeError('');
                                setChangeSuccess('');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-white transition"
                        >
                            <KeyRound className="h-3.5 w-3.5 text-sky-400" />
                            <span>비밀번호 변경</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition"
                            title="로그아웃"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            <span>로그아웃</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* 메인 콘텐츠 (대시보드) */}
            {children}

            {/* 비밀번호 변경 모달 */}
            {isChangeModalOpen && (
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    onClick={() => setIsChangeModalOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-3xl border border-white/12 bg-[#0c1427] p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <div className="flex items-center gap-2.5">
                                <KeyRound className="h-5 w-5 text-sky-400" />
                                <h3 className="text-lg font-black text-white">관리자 비밀번호 변경</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsChangeModalOpen(false)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                    현재 비밀번호
                                </label>
                                <input
                                    type="password"
                                    value={currentPwd}
                                    onChange={(e) => setCurrentPwd(e.target.value)}
                                    placeholder="현재 비밀번호를 입력하세요"
                                    autoFocus
                                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                    새 비밀번호
                                </label>
                                <input
                                    type="password"
                                    value={newPwd}
                                    onChange={(e) => setNewPwd(e.target.value)}
                                    placeholder="새 비밀번호를 입력하세요"
                                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                    새 비밀번호 확인
                                </label>
                                <input
                                    type="password"
                                    value={confirmPwd}
                                    onChange={(e) => setConfirmPwd(e.target.value)}
                                    placeholder="새 비밀번호를 다시 입력하세요"
                                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                                />
                            </div>

                            {changeError && (
                                <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{changeError}</span>
                                </div>
                            )}

                            {changeSuccess && (
                                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    <span>{changeSuccess}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    type="submit"
                                    className="flex-1 rounded-xl bg-sky-500 py-2.5 text-sm font-black text-white hover:bg-sky-400 transition"
                                >
                                    비밀번호 저장
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetToDefault}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition"
                                    title="초기값(0602)으로 재설정"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span>초기화</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
