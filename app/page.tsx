'use client';

import { useEffect, useState } from 'react';
import SeatingMap from './components/SeatingMap';

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-white dark:bg-gray-900" suppressHydrationWarning={true} />;
  }

  return <SeatingMap />;
}
