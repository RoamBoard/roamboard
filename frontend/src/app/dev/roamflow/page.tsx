import type { Metadata } from "next";
import RoamFlowLab from "@/components/features/discover/roamflow/RoamFlowLab";

export const metadata: Metadata = {
    title: "RoamFlow lab | Roamboard",
    robots: { index: false, follow: false }
};

export default function RoamFlowLabPage() {
    return <RoamFlowLab />;
}
