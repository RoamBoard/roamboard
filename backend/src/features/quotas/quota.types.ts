export type QuotaPeriod = "second" | "minute" | "hour" | "day" | "month";

export interface QuotaWindow {
    period: QuotaPeriod;
    limit: number;
    timeZone: string;
    rolling?: boolean;
}

export interface QuotaPolicy {
    id: string;
    provider: string;
    operation: string;
    windows: QuotaWindow[];
}

export interface QuotaReservationWindow extends QuotaWindow {
    name: string;
    startsAt: Date;
    endsAt: Date;
}

export interface QuotaRepository {
    reserve(
        policyId: string,
        units: number,
        windows: QuotaReservationWindow[]
    ): Promise<{ allowed: boolean; retryAt?: Date }>;
    block?(policyId: string, until: Date): Promise<void>;
}

export interface ProviderQuotaSignal {
    status: number;
    retryAt?: Date;
    exhausted?: boolean;
}

export type QuotaObserver = (signal: ProviderQuotaSignal) => Promise<void>;
