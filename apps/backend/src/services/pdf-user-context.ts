import { UsersAndOrganizationsAdapter } from '../db/tables/users-and-organizations.adapter';

export interface PdfUserContext {
  /** Department / unit label for the form holder in this organization */
  holderUnitName?: string;
  /** Resolved display names for user ids (approvers, recorder, etc.) */
  userNamesById: Readonly<Record<string, string>>;
}

/**
 * Loads holder unit metadata and display names needed for PDF generation.
 * Logs and continues when an individual lookup fails.
 */
export async function loadPdfUserContext(
  usersAdapter: UsersAndOrganizationsAdapter,
  organizationId: string,
  holderUserId: string,
  extraUserIds: readonly string[]
): Promise<PdfUserContext> {
  const userNamesById: Record<string, string> = {};
  const ids = [...new Set([holderUserId, ...extraUserIds].filter(Boolean))];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const u = await usersAdapter.getUserFromDB(id);
        if (u?.name?.trim()) {
          userNamesById[id] = u.name.trim();
        }
      } catch (e) {
        console.warn(`[loadPdfUserContext] failed to load user ${id}`, e);
      }
    })
  );

  let holderUnitName: string | undefined;
  try {
    const uio = await usersAdapter.getUserInOrganization(
      holderUserId,
      organizationId
    );
    const d = uio?.department?.roleDescription?.trim();
    if (d) {
      holderUnitName = d;
    }
  } catch (e) {
    console.warn(
      `[loadPdfUserContext] failed to load holder org row ${holderUserId}@${organizationId}`,
      e
    );
  }

  return { userNamesById, holderUnitName };
}

export function pdfResolvedUserName(
  userId: string | undefined,
  ctx: PdfUserContext
): string {
  if (!userId) {
    return '';
  }
  return ctx.userNamesById[userId] ?? userId;
}
