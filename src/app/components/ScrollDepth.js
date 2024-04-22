import { useEffect, useRef } from 'react';
import { db, auth } from '../firebase/config';
import { collection, doc, setDoc } from "firebase/firestore";

const ScrollDepth = ({ verse }) => {
  const startTime = useRef(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userId = user.uid;

      const logScrollDepth = () => {
        if (!startTime.current) {
          startTime.current = new Date().getTime();
        }

        const currentTime = new Date().getTime();
        const timeSpentInSeconds = (currentTime - startTime.current) / 1000;
        const timeSpentInMinutes = timeSpentInSeconds / 60;

        const verseElement = document.getElementById(`verse${verse}`);
        if (!verseElement) return;

        const scrollHeight = verseElement.scrollHeight;
        const scrollTop = window.scrollY;
        const verseTopOffset = verseElement.offsetTop;
        const windowHeight = window.innerHeight;

        // Calculate scroll depth within the verse
        const verseScrollDepth = ((scrollTop - verseTopOffset) / (scrollHeight - windowHeight)) * 100;

        // Check if scrolling down and scroll depth is less than 100
        if (scrollTop > lastScrollY.current && verseScrollDepth < 100) {
          // Push scroll data to Firebase Firestore
          const userRef = doc(db, 'users', userId);
          const scrollDataRef = doc(collection(userRef, 'scrollData'), 'data');
          setDoc(scrollDataRef, {
            [`${verse}`]: {
              scrollDepth: verseScrollDepth.toFixed(2),
              timeSpent: timeSpentInMinutes.toFixed(2),
              timestamp: new Date()
            }
          }, { merge: true });
        }

        lastScrollY.current = scrollTop;
      };

      // Attach scroll event listener
      window.addEventListener('scroll', logScrollDepth);

      // Cleanup the event listener on component unmount
      return () => {
        window.removeEventListener('scroll', logScrollDepth);
      };
    };

    fetchData();
  }, [verse]);

  useEffect(() => {
    const handlePageChange = () => {
      console.log(`Page changed. Stopping the timer.`);
      startTime.current = null;
    };

    // Add event listener for page change (e.g., when user navigates away)
    window.addEventListener('unload', handlePageChange);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener('unload', handlePageChange);
    };
  }, []);

  return null;
};

export default ScrollDepth;
