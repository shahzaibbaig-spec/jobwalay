export type FormState = { error?: string; message?: string; token?: string };
export function invalid(): FormState { return { error: 'Check your entries and try again.' }; }
