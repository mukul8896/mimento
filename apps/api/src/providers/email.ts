/** Email port — Phase 2 notifications (SMTP adapter first). No Phase 1 implementation. */
export interface EmailSender {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}
