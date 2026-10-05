import Link from "next/link";

type Props = {
    mode: "login" | "signup";
};

export default function GoogleAuthPanel({ mode }: Props) {
    const isSignup = mode === "signup";

    return (
        <section
            aria-labelledby="auth-title"
            className="text-foreground mx-auto w-full max-w-sm"
        >
            <h1 id="auth-title" className="font-display text-36">
                {isSignup ? "Create account" : "Log in"}
            </h1>
            <p className="text-14 mt-3 mb-8">
                {isSignup
                    ? "Use your Google account to join Roamboard."
                    : "Use your Google account to log in to Roamboard."}
            </p>
            <button
                type="button"
                disabled
                aria-describedby="auth-preview"
                className="border-foreground text-14 w-full cursor-not-allowed border px-4 py-3 text-center opacity-50"
            >
                Continue with Google
            </button>
            <p id="auth-preview" className="text-14 mt-4">
                Layout preview. Google sign-in is not connected yet.
            </p>
            <p className="text-14 mt-8">
                {isSignup ? "Already have an account? " : "New to Roamboard? "}
                <Link
                    href={isSignup ? "/login" : "/signup"}
                    className="underline underline-offset-4 focus-visible:outline-1 focus-visible:outline-offset-4"
                >
                    {isSignup ? "Log in" : "Create account"}
                </Link>
            </p>
        </section>
    );
}
