interface GoogleCredentialResponse {
    credential?: string;
}

interface GoogleIdentityApi {
    accounts: {
        id: {
            initialize(options: {
                client_id: string;
                callback: (response: GoogleCredentialResponse) => void;
                ux_mode: "popup";
            }): void;
            renderButton(
                element: HTMLElement,
                options: {
                    theme: "outline";
                    size: "large";
                    text: "signin_with" | "signup_with";
                    width: number;
                }
            ): void;
        };
    };
}

interface Window {
    google?: GoogleIdentityApi;
}
