export type QuotaPeriod = "second" | "minute" | "hour" | "day" | "month";

export interface QuotaWindow {
    period: QuotaPeriod;
    limit: number;
    timeZone: string;
}

export interface QuotaPolicy {
    id: string;
    provider: string;
    operation: string;
    unit: string;
    sourceUrl: string;
    windows: QuotaWindow[];
}

export interface QuotaReservationWindow extends QuotaWindow {
    name: string;
    startsAt: Date;
    endsAt: Date;
}

export interface QuotaUsageWindow {
    name: string;
    period: QuotaPeriod;
    limit: number;
    used: number;
    remaining: number;
    startsAt: string;
    resetsAt: string;
    timeZone: string;
}

export interface QuotaStatus {
    id: string;
    provider: string;
    operation: string;
    unit: string;
    sourceUrl: string;
    windows: QuotaUsageWindow[];
}

export interface QuotaReservationResult {
    allowed: boolean;
    blocked?: QuotaUsageWindow;
}

export interface QuotaRepository {
    reserve(policyId: string, units: number, windows: QuotaReservationWindow[]): Promise<QuotaReservationResult>;
    usage(policyId: string, windows: QuotaReservationWindow[]): Promise<number[]>;
    readonly durable: boolean;
}
