declare const _default: () => {
    nodeEnv: string;
    appEnv: string;
    port: number;
    apiBaseUrl: string;
    frontendAllowedOrigins: string[];
    auth: {
        devBypass: boolean;
        devUserId: string;
        devEmail: string;
        devName: string;
        issuerUrl: string;
        audience: string;
        jwksUrl: string;
    };
    gemini: {
        apiKey: string;
        model: string;
        timeoutMs: number;
        maxRetries: number;
        dailyQuota: number;
    };
    cloudinary: {
        cloudName: string;
        apiKey: string;
        apiSecret: string;
        uploadFolder: string;
        deliveryType: string;
    };
    minUserAge: number;
};
export default _default;
