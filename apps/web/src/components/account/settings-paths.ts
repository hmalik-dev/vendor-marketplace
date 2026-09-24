/** The settings list, and the detail page each setting opens (VEN-703). */
export const ACCOUNT_SETTINGS_PATH = '/account/settings';
export const ACCOUNT_NAME_PATH = `${ACCOUNT_SETTINGS_PATH}/name`;
export const ACCOUNT_PASSWORD_PATH = `${ACCOUNT_SETTINGS_PATH}/password`;
export const ACCOUNT_CLOSE_PATH = `${ACCOUNT_SETTINGS_PATH}/close`;
/** Where a person lands once they have closed their account; public, outside the settings area. */
export const ACCOUNT_CLOSED_PATH = '/account/closed';

/** The list's `?saved=` query, and the confirmation each value shows. */
export const SETTINGS_SAVED_PARAM = 'saved';
export const SETTINGS_SAVED_COPY: Record<string, string> = {
  name: 'Your name is saved.',
};
