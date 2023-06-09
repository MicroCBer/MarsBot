import { Api, TelegramClient } from "telegram";

export declare interface CheckerGenerateContext {
    message: Api.Message;
    client: TelegramClient;
    getMedia: () => Promise<string | Buffer | undefined>;
    getMediaPath: () => Promise<string | undefined>;
}

export declare interface CheckerCheckContext {
    before: () => Promise<Api.Message>;
    this: () => Promise<Api.Message>;
    client: TelegramClient;
    getMediaCached: (msg: Api.Message) => Promise<string | Buffer | undefined>;
    getMediaCachedPath: (msg: Api.Message) => Promise<string | undefined>;
}

