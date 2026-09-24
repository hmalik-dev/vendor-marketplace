/** The settings list, and the detail page each setting opens (VEN-703). */
export const ACCOUNT_SETTINGS_PATH = '/account/settings';
export const ACCOUNT_NAME_PATH = `${ACCOUNT_SETTINGS_PATH}/name`;
export const ACCOUNT_PASSWORD_PATH = `${ACCOUNT_SETTINGS_PATH}/password`;
export const ACCOUNT_SESSIONS_PATH = `${ACCOUNT_SETTINGS_PATH}/sessions`;

/** The list's `?saved=` query, and the confirmation each value shows. */
export const SETTINGS_SAVED_PARAM = 'saved';
export const SETTINGS_SAVED_COPY: Record<string, string> = {
  name: 'Your name is saved.',
};
