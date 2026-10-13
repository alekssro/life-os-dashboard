/**
 * Map Superlist lists to Life OS Domains.
 *
 * Each Superlist list becomes a Life OS Domain. Matching is:
 *   1. the domain already linked to the list id (rename-safe), else
 *   2. an existing domain with the same name (case-insensitive), else
 *   3. a newly created domain.
 *
 * The domain's Superlist list id/URL are kept up to date so the dashboard can
 * deep-link straight back into the list.
 */

import { prisma } from '@/lib/prisma';
import { buildSuperlistListUrl } from '@/lib/superlist';

export interface SuperlistListMeta {
  id: string;
  title: string;
  url?: string | null;
}

export interface DomainSyncOutcome {
  domainId: string;
  created: boolean;
  linked: boolean;
}

/** URL-safe slug from a domain/list name. */
export function slugifyDomainName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Find or create the Life OS Domain that represents a Superlist list.
 */
export async function findOrCreateDomainForList(
  list: SuperlistListMeta
): Promise<DomainSyncOutcome> {
  const title = (list.title || '').trim();
  const name = title || `Superlist ${list.id.slice(0, 8)}`;
  const url = list.url || buildSuperlistListUrl(list.id);

  // 1. Already linked to this Superlist list id.
  let domain = await prisma.domain.findFirst({ where: { superlistListId: list.id } });
  if (domain) {
    // Keep the user's domain name; only refresh the list link.
    if (domain.superlistUrl !== url) {
      domain = await prisma.domain.update({
        where: { id: domain.id },
        data: { superlistUrl: url },
      });
    }
    return { domainId: domain.id, created: false, linked: false };
  }

  // 2. Adopt an existing, unclaimed domain with the same name.
  domain = await prisma.domain.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      OR: [{ superlistListId: null }, { superlistListId: list.id }],
    },
  });
  if (domain) {
    domain = await prisma.domain.update({
      where: { id: domain.id },
      data: { superlistListId: list.id, superlistUrl: url },
    });
    return { domainId: domain.id, created: false, linked: true };
  }

  // 3. Create a new domain (slug must be unique).
  const base = slugifyDomainName(name) || `superlist-${list.id.slice(0, 8)}`;
  let slug = base;
  let n = 1;
  while (await prisma.domain.findUnique({ where: { slug } })) {
    slug = `${base}-${++n}`;
  }

  const created = await prisma.domain.create({
    data: {
      name,
      slug,
      superlistListId: list.id,
      superlistUrl: url,
    },
  });
  return { domainId: created.id, created: true, linked: false };
}

/**
 * Resolve the Life OS Domain that a Superlist list is linked to (if any).
 * Used by the push endpoints to infer a task's domain from its list.
 */
export async function resolveDomainIdForList(
  listId: string | null | undefined
): Promise<string | null> {
  if (!listId) return null;
  const domain = await prisma.domain.findFirst({
    where: { superlistListId: listId },
    select: { id: true },
  });
  return domain?.id ?? null;
}
