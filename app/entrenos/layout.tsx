import CoachShell from '@/components/CoachShell'
import TrainingWorkspaceShell from '@/components/training/TrainingWorkspaceShell'

export default function EntrenosLayout({ children }: { children: React.ReactNode }) {
  return (
    <CoachShell>
      <TrainingWorkspaceShell>{children}</TrainingWorkspaceShell>
    </CoachShell>
  )
}
