import CoachShell from '@/components/CoachShell'
import TrainingSubNav from '@/components/training/TrainingSubNav'

export default function EntrenosLayout({ children }: { children: React.ReactNode }) {
  return (
    <CoachShell>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <TrainingSubNav />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </CoachShell>
  )
}
