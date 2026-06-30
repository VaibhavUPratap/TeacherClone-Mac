import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    // Redirect to the subjects selection page on load
    navigate('/dashboard/subjects');
  }, [navigate]);

  return null; // No UI needed as we redirect immediately
}

export default Home;
