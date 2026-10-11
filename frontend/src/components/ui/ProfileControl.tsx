"use client";

import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem
} from "@/components/ui/dropdown-menu";

export type ProfileControlProps = {
    user?: { name: string } | null;
};

export default function ProfileControl({ user = null }: ProfileControlProps) {
    const controlClasses =
        "absolute left-[36%] right-[8%] top-[45%] text-left text-14 leading-tight underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4";

    return (
        <div className="absolute top-0 right-[1.3%] z-10 h-[8.75rem] w-[8.25rem] sm:h-[24%] sm:w-[14.5%]">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
            >
                <span className="bg-decorative-line absolute top-[18%] right-[9%] left-0 h-0.5" />
                <span className="bg-decorative-line absolute top-0 right-[17%] h-[39%] w-0.5" />
                <span className="bg-decorative-line absolute top-[25%] bottom-0 left-[32%] w-0.5" />
                <span className="bg-decorative-line absolute top-[66%] right-0 left-[16%] h-0.5" />
            </div>
            {user ? (
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={`${controlClasses} cursor-pointer truncate`}
                        >
                            {user.name}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        aria-label="Account"
                        align="end"
                        sideOffset={8}
                        collisionPadding={8}
                        className="w-44"
                    >
                        <DropdownMenuItem asChild>
                            <Link href="/profile">My profile</Link>
                        </DropdownMenuItem>
                        {/* Logout is unavailable until authentication is connected. */}
                        <DropdownMenuItem asChild disabled>
                            <button type="button" disabled>
                                Log out
                            </button>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Link href="/login" className={controlClasses}>
                    Sign up /
                    <br />
                    Log in
                </Link>
            )}
        </div>
    );
}
