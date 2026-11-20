import { AppError } from "../../shared/app-error.js";
import type { AccountDeletionRepository } from "./account-deletion.repository.js";

export interface AccountDeletionService {
    deleteAccount(userId: string): Promise<void>;
}

export function createAccountDeletionService(repository: AccountDeletionRepository): AccountDeletionService {
    return {
        async deleteAccount(userId) {
            const result = await repository.deleteAccount(userId);
            if (result === "missing") throw new AppError(401, "Not signed in", "UNAUTHENTICATED");
            if (result === "guest")
                throw new AppError(
                    403,
                    "Account deletion is unavailable for this account",
                    "ACCOUNT_DELETION_UNAVAILABLE"
                );
        }
    };
}
