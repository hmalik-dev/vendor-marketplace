/**
 * The shortest password the product accepts. The sign-up, reset and change forms
 * disable their button below it, and the auth proxy refuses a shorter one, so a
 * hand-made request cannot set what the forms would not (VEN-685).
 */
export const PASSWORD_MIN_LENGTH = 10;
