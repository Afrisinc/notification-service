import { prismaWrite, prismaRead } from '@shared/database';

export class SecurityRepository {
  async getFailedLoginsCount(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return prismaRead.loginFailure.count({
      where: {
        createdAt: {
          gte: since,
        },
      },
    });
  }

  async getTokenIssuanceCount() {
    return prismaRead.token.count();
  }

  async getTopIPs(hours: number = 24, limit: number = 5) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const failures = await prismaRead.loginFailure.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      select: {
        ip_address: true,
      },
    });

    // Group by IP and count
    const ipCounts: Record<string, number> = {};
    failures.forEach((f) => {
      ipCounts[f.ip_address] = (ipCounts[f.ip_address] || 0) + 1;
    });

    // Convert to array and sort
    const topIPs = Object.entries(ipCounts)
      .map(([ip, attempts]) => ({ ip, attempts }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, limit);

    return topIPs;
  }

  async detectSuspiciousActivity(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Check if any IP has > 20 failed attempts
    const topIPs = await this.getTopIPs(hours, 100);
    if (topIPs.some((entry) => entry.attempts > 20)) {
      return true;
    }

    // Check if any email has > 15 failed attempts
    const emailFailures = await prismaRead.loginFailure.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      select: {
        email: true,
      },
    });

    const emailCounts: Record<string, number> = {};
    emailFailures.forEach((f) => {
      emailCounts[f.email] = (emailCounts[f.email] || 0) + 1;
    });

    if (Object.values(emailCounts).some((count) => count > 15)) {
      return true;
    }

    // Check for coordinated attack (multiple IPs, same email)
    const coordinatedAttacks = await prismaRead.loginFailure.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      select: {
        email: true,
        ip_address: true,
      },
    });

    const emailToIPs: Record<string, Set<string>> = {};
    coordinatedAttacks.forEach((f) => {
      if (!emailToIPs[f.email]) {
        emailToIPs[f.email] = new Set();
      }
      emailToIPs[f.email].add(f.ip_address);
    });

    if (Object.values(emailToIPs).some((ips) => ips.size > 2)) {
      return true;
    }

    return false;
  }

  async getRecentFailedLogins(hours: number = 24, limit: number = 10) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return prismaRead.loginFailure.findMany({
      where: {
        createdAt: {
          gte: since,
        },
      },
      select: {
        id: true,
        email: true,
        ip_address: true,
        failure_reason: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  async createLoginFailure(data: {
    email: string;
    ip_address: string;
    failure_reason: string;
    user_id?: string;
    session_id?: string;
  }) {
    return prismaRead.loginFailure.create({
      data,
    });
  }

  async createToken(data: { user_id: string; token_type: string; expires_at?: Date }) {
    return prismaRead.token.create({
      data,
    });
  }

  async revokeToken(token_id: string) {
    return prismaRead.token.update({
      where: { id: token_id },
      data: { revoked_at: new Date() },
    });
  }

  async getLoginEvents(options: { page: number; limit: number; search?: string; sortBy?: 'asc' | 'desc' }) {
    const { page, limit, search, sortBy = 'desc' } = options;

    // Build search filter - matches name (firstName + lastName), phone, or IP
    const searchFilter = search
      ? {
          OR: [
            {
              user: {
                firstName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            },
            {
              user: {
                lastName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            },
            {
              user: {
                phone: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            },
            {
              ip: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : undefined;

    const failureSearchFilter = search
      ? {
          OR: [
            {
              user: {
                firstName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            },
            {
              user: {
                lastName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            },
            {
              user: {
                phone: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            },
            {
              ip_address: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : undefined;

    const result = await prismaRead.$transaction(async (tx) => {
      // Fetch all matching records without pagination at database level
      // Apply a reasonable limit to prevent huge queries (10000 max per table)
      const events = await tx.loginEvent.findMany({
        where: searchFilter,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
        orderBy: {
          createdAt: sortBy,
        },
        take: 10000,
      });

      const failures = await tx.loginFailure.findMany({
        where: failureSearchFilter,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
        orderBy: {
          createdAt: sortBy,
        },
        take: 10000,
      });

      return { events, failures };
    });

    // Combine and format results
    const combinedEvents = [
      ...result.events.map((event) => ({
        id: event.id,
        type: 'login_event',
        userId: event.user_id,
        email: event.user?.email || 'N/A',
        name: event.user ? `${event.user.firstName || ''} ${event.user.lastName || ''}`.trim() : 'N/A',
        phone: event.user?.phone || 'N/A',
        status: event.status,
        ip: event.ip || 'N/A',
        createdAt: event.createdAt,
      })),
      ...result.failures.map((failure) => ({
        id: failure.id,
        type: 'login_failure',
        userId: failure.user_id,
        email: failure.email,
        name: failure.user ? `${failure.user.firstName || ''} ${failure.user.lastName || ''}`.trim() : 'N/A',
        phone: failure.user?.phone || 'N/A',
        status: 'failed',
        ip: failure.ip_address,
        reason: failure.failure_reason,
        createdAt: failure.createdAt,
      })),
    ];

    // Sort combined results by createdAt
    combinedEvents.sort((a, b) =>
      sortBy === 'desc' ? b.createdAt.getTime() - a.createdAt.getTime() : a.createdAt.getTime() - b.createdAt.getTime()
    );

    // Apply pagination to combined results
    const totalCombined = combinedEvents.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEvents = combinedEvents.slice(startIndex, endIndex);

    return {
      data: paginatedEvents,
      pagination: {
        page,
        limit,
        total: totalCombined,
        pages: Math.ceil(totalCombined / limit),
      },
    };
  }
}
