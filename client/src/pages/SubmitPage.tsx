import { Navigate, useParams } from 'react-router-dom';

export default function SubmitPage() {
  const { problemId } = useParams();
  if (!problemId) {
    return <Navigate to="/contests" replace />;
  }
  return <Navigate to={`/problems/${problemId}`} replace />;
}
