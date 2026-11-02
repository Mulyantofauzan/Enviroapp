import { useAuth } from '../auth/AuthContext';
import { ScreenHeader } from '../ui/ScreenHeader';

// Placeholder until Task 8 builds the real screen.
export function BerandaOperator() {
  const { user } = useAuth();
  return <ScreenHeader title={`Halo, ${user?.name.split(' ')[0] ?? ''}`} />;
}
