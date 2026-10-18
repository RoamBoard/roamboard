"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
    ArrowUpRight,
    Compass,
    FlaskConical,
    Layers,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Users,
    X
} from "lucide-react";
import ProfileControl, { type ProfileControlProps } from "@/components/ui/ProfileControl";
import NotificationControl from "@/components/ui/NotificationControl";
import { getSidebarExpanded, getSidebarServerSnapshot, setSidebarExpanded, subscribeSidebar } from "./sidebar-state";

const navigation = [
    { href: "/home", label: "roam", icon: ArrowUpRight },
    { href: "/create", label: "create", icon: Plus },
    { href: "/discover", label: "discover", icon: Compass },
    { href: "/boards", label: "boards", icon: Layers },
    { href: "/social", label: "social", icon: Users },
    { href: "/dev/providers", label: "labs", icon: FlaskConical }
];

function subscribeDesktop(callback: () => void) {
    const query = window.matchMedia("(min-width: 768px)");
    query.addEventListener("change", callback);
    return () => query.removeEventListener("change", callback);
}
const getDesktopSnapshot = () => window.matchMedia("(min-width: 768px)").matches;
const getDesktopServerSnapshot = () => true;

function activeDestination(pathname: string | null, fallback: string) {
    if (!pathname) return fallback;
    if (pathname.startsWith("/dev")) return "/dev/providers";
    if (
        pathname === "/boards/new" ||
        pathname.startsWith("/boards/drafts") ||
        /^\/boards\/[^/]+\/edit$/.test(pathname)
    ) {
        return "/create";
    }
    if (pathname === "/profile" || pathname === "/settings" || pathname === "/notifications") return "/social";
    return navigation.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))?.href ?? fallback;
}

type NavigationProps = {
    activeHref: string;
    expanded: boolean;
    compactTop?: boolean;
    onNavigate?: () => void;
};

function SidebarNavigation({ activeHref, expanded, compactTop = false, onNavigate }: NavigationProps) {
    const reducedMotion = useReducedMotion();
    function renderLink({ href, label, icon: Icon }: (typeof navigation)[number]) {
        const active = activeHref === href;
        return (
            <li key={href} className="group relative">
                <Link
                    href={href}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={`relative flex h-11 items-center transition-colors duration-150 focus-visible:outline-1 focus-visible:outline-offset-4 motion-reduce:transition-none ${expanded ? "w-full" : "w-11"} ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                    <Icon aria-hidden="true" className="mx-3 size-5 shrink-0" strokeWidth={1.5} />
                    {!expanded && active && (
                        <span aria-hidden="true" className="absolute bottom-1 left-3 h-px w-5 bg-current" />
                    )}
                    <motion.span
                        aria-hidden="true"
                        initial={false}
                        animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -4 }}
                        transition={{
                            duration: reducedMotion ? 0 : 0.16,
                            delay: expanded && !reducedMotion ? 0.08 : 0
                        }}
                        className={`font-body text-14 absolute left-12 font-medium whitespace-nowrap underline-offset-[6px] ${expanded ? "block" : "hidden"} ${active ? "underline" : "group-hover:underline"}`}
                    >
                        {label}
                    </motion.span>
                </Link>
            </li>
        );
    }
    return (
        <nav
            aria-label="Main navigation"
            className={`flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain transition-all duration-200 ${expanded ? "px-4" : "px-2.5 md:px-[18px]"}`}
        >
            <ul
                className={`mb-4 flex w-full shrink-0 flex-col gap-2 transition-[padding] duration-200 ${compactTop ? "pt-1" : "pt-8 [@media(max-height:650px)]:pt-0"}`}
            >
                {navigation.map(renderLink)}
            </ul>
        </nav>
    );
}

function MobileSidebar({
    activeHref,
    id,
    onClose,
    restoreFocus
}: {
    activeHref: string;
    id: string;
    onClose: () => void;
    restoreFocus: () => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [closing, setClosing] = useState(false);
    const requestClose = () => setClosing(true);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        const dialog = dialogRef.current;
        const previousOverflow = document.body.style.overflow;
        dialog?.showModal();
        document.body.style.overflow = "hidden";
        // Resizing to desktop dismisses the temporary drawer.
        const query = window.matchMedia("(min-width: 768px)");
        const onResize = () => {
            if (query.matches) onClose();
        };
        query.addEventListener("change", onResize);
        return () => {
            query.removeEventListener("change", onResize);
            dialog?.close();
            document.body.style.overflow = previousOverflow;
            restoreFocus();
        };
    }, [onClose, restoreFocus]);

    return (
        <dialog
            id={id}
            ref={dialogRef}
            aria-label="Roamboard navigation"
            onCancel={(event) => {
                event.preventDefault();
                requestClose();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) requestClose();
            }}
            className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-inherit backdrop:bg-black/35 backdrop:backdrop-blur-sm"
        >
            <motion.div
                initial={{ x: reducedMotion ? 0 : -24, opacity: 0 }}
                animate={{ x: closing && !reducedMotion ? -24 : 0, opacity: closing ? 0 : 1 }}
                onAnimationComplete={() => {
                    if (closing) onClose();
                }}
                transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="bg-background text-foreground border-line flex h-full w-[min(18rem,calc(100vw-3rem))] flex-col border-r pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
            >
                <header className="flex items-center justify-between gap-3 px-5 pb-12">
                    <Link
                        href="/home"
                        aria-label="Roamboard home"
                        onClick={requestClose}
                        className="font-display text-24 font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        ROAMBOARD
                    </Link>
                    <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={requestClose}
                        className="hover:bg-faint grid size-11 shrink-0 cursor-pointer place-items-center focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <X aria-hidden="true" size={20} strokeWidth={1.5} />
                    </button>
                </header>
                <SidebarNavigation activeHref={activeHref} expanded onNavigate={requestClose} />
            </motion.div>
        </dialog>
    );
}

export default function Sidebar({ activeHref, profile = {} }: { activeHref: string; profile?: ProfileControlProps }) {
    const pathname = usePathname();
    const selectedHref = activeDestination(pathname, activeHref);
    const savedExpanded = useSyncExternalStore(subscribeSidebar, getSidebarExpanded, getSidebarServerSnapshot);
    const desktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getDesktopServerSnapshot);
    const [accountOpen, setAccountOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [hovered, setHovered] = useState(false);
    const expanded = (desktop && (savedExpanded || hovered)) || accountOpen || notificationsOpen;
    const sidebarWidth = expanded ? "176px" : "80px";
    const compactTop = accountOpen || notificationsOpen;
    const [mobileOpen, setMobileOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const reducedMotion = useReducedMotion();
    const panelId = useId();

    // The saved desktop preference never opens the mobile drawer automatically.
    const closeMobile = useCallback(() => {
        setMobileOpen(false);
    }, []);
    const restoreFocus = useCallback(() => {
        triggerRef.current?.focus();
    }, []);

    return (
        <>
            <motion.aside
                aria-label="Roamboard sidebar"
                initial={false}
                animate={{ "--sidebar-width": sidebarWidth }}
                transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                onPointerEnter={(event) => {
                    if (desktop && event.pointerType !== "touch") setHovered(true);
                }}
                onPointerLeave={() => setHovered(false)}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        if (notificationsOpen) {
                            setNotificationsOpen(false);
                        }
                        if (accountOpen) {
                            setAccountOpen(false);
                        }
                        setHovered(false);
                        if (savedExpanded) {
                            setSidebarExpanded(false);
                        }
                    }
                }}
                className={`bg-background text-foreground border-line fixed inset-y-0 left-0 z-40 flex ${accountOpen ? "w-56" : "w-16"} flex-col border-r pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))] md:w-[var(--sidebar-width)] [@media(max-height:400px)]:pb-2 ${expanded ? "shadow-[16px_0_40px_-24px_rgb(0_0_0/0.25)]" : ""}`}
            >
                <header
                    className={`relative shrink-0 transition-[height] duration-200 ease-out ${compactTop ? "h-16 md:h-20" : "h-[clamp(11rem,25dvh,15rem)]"} [@media(max-height:400px)]:h-12 [@media(max-height:650px)]:h-20`}
                >
                    <Link
                        href="/home"
                        aria-label="Roamboard home"
                        className={`font-display absolute top-7 left-[20px] leading-none font-bold tracking-tight whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4 md:left-[25px] [@media(max-height:400px)]:top-3 ${expanded ? "text-20" : "text-24 md:text-30"}`}
                    >
                        {expanded ? (
                            <span>Roamboard</span>
                        ) : (
                            <>
                                <span className="[writing-mode:vertical-rl] [@media(max-height:650px)]:hidden">
                                    ROAMBOARD
                                </span>
                                <span className="hidden [@media(max-height:650px)]:inline" aria-hidden="true">
                                    R.
                                </span>
                            </>
                        )}
                    </Link>
                </header>
                <div id={panelId} className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <SidebarNavigation activeHref={selectedHref} expanded={expanded} compactTop={compactTop} />
                </div>
                <div className="mx-2.5 mt-auto flex shrink-0 flex-col gap-1 md:mx-4">
                    <NotificationControl
                        sidebar
                        iconOnly={!expanded}
                        open={notificationsOpen}
                        onOpenChange={(open) => {
                            setNotificationsOpen(open);
                            if (open) setAccountOpen(false);
                        }}
                    />
                    <ProfileControl
                        {...profile}
                        sidebar
                        iconOnly={!expanded}
                        sidebarAccountOpen={accountOpen}
                        onSidebarOpenChange={(open) => {
                            setAccountOpen(open);
                            if (open) setNotificationsOpen(false);
                        }}
                    />
                </div>
                <div aria-hidden="true" className="border-line mx-2.5 mt-3 border-t md:mx-4" />
                <button
                    type="button"
                    ref={triggerRef}
                    aria-label={
                        desktop
                            ? savedExpanded
                                ? "Collapse navigation"
                                : expanded
                                  ? "Keep navigation expanded"
                                  : "Expand navigation"
                            : "Open navigation"
                    }
                    aria-expanded={desktop ? expanded : mobileOpen}
                    aria-haspopup={desktop ? undefined : "dialog"}
                    aria-controls={desktop ? panelId : `${panelId}-drawer`}
                    onClick={() => {
                        if (desktop) {
                            setAccountOpen(false);
                            setNotificationsOpen(false);
                            setHovered(false);
                            setSidebarExpanded(!savedExpanded);
                        } else setMobileOpen(true);
                    }}
                    className={`text-muted-foreground/50 hover:text-muted-foreground mx-2.5 mt-3 flex h-11 shrink-0 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-offset-4 md:mx-4 ${desktop && expanded ? "px-3" : "justify-center"}`}
                >
                    {desktop && savedExpanded ? (
                        <PanelLeftClose aria-hidden="true" size={20} strokeWidth={1.5} />
                    ) : (
                        <PanelLeftOpen aria-hidden="true" size={20} strokeWidth={1.5} />
                    )}
                    {desktop && expanded && (
                        <span className="text-12 ml-3 whitespace-nowrap">
                            {savedExpanded ? "collapse" : "keep open"}
                        </span>
                    )}
                </button>
            </motion.aside>
            {mobileOpen && (
                <MobileSidebar
                    activeHref={selectedHref}
                    id={`${panelId}-drawer`}
                    onClose={closeMobile}
                    restoreFocus={restoreFocus}
                />
            )}
        </>
    );
}
