import GuideLines from "@/components/layout/GuideLines";
import YesPleaseButton from "@/components/ui/YesPleaseButton";
import Tagline from "@/components/features/start-page/Tagline";
import IntroText from "@/components/features/start-page/IntroText";
import Wordmark from "@/components/features/start-page/Wordmark";

export default function StartPage() {
    return (
        <main className="text-obsidian relative h-dvh min-h-[32rem] overflow-hidden bg-white">
            <GuideLines />

            {/* Content area = the box formed by the guide lines */}
            <div className="absolute inset-x-[2.25%] inset-y-[3.5%]">
                <Tagline />
                <IntroText />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <YesPleaseButton href="/home" />
                </div>
                <Wordmark />
            </div>
        </main>
    );
}
