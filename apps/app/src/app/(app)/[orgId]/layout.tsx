import { AnimatedLayout } from '@/components/animated-layout';
import { CheckoutCompleteDialog } from '@/components/dialogs/checkout-complete-dialog';
import { Header } from '@/components/header';
import { AssistantSheet } from '@/components/sheets/assistant-sheet';
import { Sidebar } from '@/components/sidebar';
import { SidebarProvider } from '@/context/sidebar-context';
import { auth } from '@/utils/auth';
import { db } from '@db';
import dynamic from 'next/dynamic';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { OnboardingTracker } from './components/OnboardingTracker';

const HotKeys = dynamic(() => import('@/components/hot-keys').then((mod) => mod.HotKeys), {
  ssr: true,
});

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId: requestedOrgId } = await params;

  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get('sidebar-collapsed')?.value === 'true';
  const publicAccessToken = cookieStore.get('publicAccessToken')?.value;

  // Check if user has access to this organization
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect('/auth/login');
  }

  // First check if the organization exists
  const organization = await db.organization.findUnique({
    where: {
      id: requestedOrgId,
    },
  });

  if (!organization) {
    // Organization doesn't exist
    return redirect('/auth/not-found');
  }

  const member = await db.member.findFirst({
    where: {
      userId: session.user.id,
      organizationId: requestedOrgId,
    },
  });

  if (!member) {
    // User doesn't have access to this organization
    return redirect('/auth/unauthorized');
  }

  const onboarding = await db.onboarding.findFirst({
    where: {
      organizationId: requestedOrgId,
    },
  });

  const isOnboardingRunning = !!onboarding?.triggerJobId && !onboarding.triggerJobCompleted;
  const navbarHeight = 53 + 1; // 1 for border
  const onboardingHeight = 132 + 1; // 1 for border

  const pixelsOffset = isOnboardingRunning ? navbarHeight + onboardingHeight : navbarHeight;

  return (
    <SidebarProvider initialIsCollapsed={isCollapsed}>
      <AnimatedLayout sidebar={<Sidebar organization={organization} />} isCollapsed={isCollapsed}>
        {onboarding?.triggerJobId && (
          <OnboardingTracker onboarding={onboarding} publicAccessToken={publicAccessToken ?? ''} />
        )}
        <Header />
        <div
          className="textured-background mx-auto px-4 py-4"
          style={{ minHeight: `calc(100vh - ${pixelsOffset}px)` }}
        >
          {children}
        </div>
        <AssistantSheet />
        <Suspense fallback={null}>
          <CheckoutCompleteDialog orgId={organization.id} />
        </Suspense>
      </AnimatedLayout>
      <HotKeys />
    </SidebarProvider>
  );
}
