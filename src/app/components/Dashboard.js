"use client"
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import Link from "next/link"

function Dashboard() {
  const [requests, setRequests] = useState([]);
  const [communityMembers, setCommunityMembers] = useState([]);
  
  const [imageURL, setImageURL] = useState(null);
  const imgUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png'
  
  const currentUser = auth.currentUser;

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        if (!currentUser) return;

        const communityIdsRef = collection(db, 'communityIds');
        const communityIdsQuery = query(communityIdsRef, where('userId', '==', currentUser.uid));
        const communityIdsSnapshot = await getDocs(communityIdsQuery);
        const communityIds = communityIdsSnapshot.docs.map(doc => doc.data());
        if (communityIds.length === 0) {
          console.error('Community IDs array is empty.');
          return;
        }

        const requestsRef = collection(db, 'communityRequests');
        const requestsQuery = query(requestsRef, where('communityId', 'in', communityIds.map(community => community.communityId)));
        const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
          const requestData = snapshot.docs.map(async (doc) => {
            const data = doc.data();
            const userName = await getUsername(data.requesterId);
            const community = communityIds.find(community => community.communityId === data.communityId);
            const communityName = community ? community.communityName : 'Unknown'; // Use ternary operator to handle undefined
            return {
              id: doc.id,
              communityName,
              userName,
              status: data.status,
              communityId: data.communityId
            };
          });
          Promise.all(requestData).then(setRequests);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching requests:', error);
        // Handle error here
      }
    };

    const fetchCommunityMembers = async () => {
      try {
        if (!currentUser) return;
    
        const communityIdsRef = collection(db, 'communityIds');
        const communityIdsQuery = query(communityIdsRef, where('userId', '==', currentUser.uid));
        const communityIdsSnapshot = await getDocs(communityIdsQuery);
        const communityIds = communityIdsSnapshot.docs.map(doc => doc.data());
        if (communityIds.length === 0) {
          console.error('Community IDs array is empty.');
          return;
        }
    
        const communityMembersData = [];
        for (const community of communityIds) {
          const communityMembersRef = collection(db, `communityMembers/${community.communityId}/users`);
          const communityMembersSnapshot = await getDocs(communityMembersRef);
          communityMembersSnapshot.forEach(async (doc) => {
            const userData = doc.data();
            const userDataWithDisplayName = await getUserData(userData.userId);
            communityMembersData.push({ userId: userData.userId, displayName: userDataWithDisplayName.displayName, photoURL: userDataWithDisplayName.photoURL, communityId: community.communityId });
          });
        }
    
        setCommunityMembers(communityMembersData);
      } catch (error) {
        console.error('Error fetching community members:', error);
        // Handle error here
      }
    };
    

    fetchRequests();
    fetchCommunityMembers();
  }, [currentUser]);

  const getUsername = async (requesterId) => {
    try {
      console.log("Fetching username for requesterId:", requesterId); // Log requesterId for debugging
      if (!requesterId) return ''; // Return an empty string if requesterId is undefined
      const userDoc = await getDoc(doc(db, 'users', requesterId)); // Assuming 'users' is the collection storing user information
      console.log("User Doc:", userDoc.data()); // Log the entire user document for debugging
      if (userDoc.exists()) {
        let displayName = userDoc.data().displayName || userDoc.data().name || 'Unknown User';
        console.log("Final Display Name:", displayName); // Log the final display name for debugging
        return displayName;
      }
    } catch (error) {
      console.error('Error fetching username:', error);
    }
    return ''; // Return an empty string if username retrieval fails
  };

  const getUserData = async (userId) => {
    try {
      console.log("Fetching user data for userId:", userId);
      if (!userId) return {};
  
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("User Data:", userData);
        return { displayName: userData.displayName, photoURL: userData.photoURL };
      } else {
        console.log("User document not found.");
        return {};
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      return {};
    }
  };

  const approveRequest = async (requestId, communityId, communityName) => {
    try {
      // Update the status of the request to 'approved' in the 'communityRequests' collection
      await updateDoc(doc(db, 'communityRequests', requestId), { status: 'approved' });

      // Retrieve the requesterId associated with the requestId
      const requestDoc = await getDoc(doc(db, 'communityRequests', requestId));
      const requesterId = requestDoc.data().requesterId;

      // Store the approved user in the communityMembers subcollection under the communityId
      const communityMembersRef = collection(db, `communityMembers/${communityId}/users`);
      await addDoc(communityMembersRef, { userId: requesterId });

      // Check if the communityMembers collection exists, if not, create it
      const communityMembersSnapshot = await getDocs(collection(db, `communityMembers/${communityId}/users`));
      if (communityMembersSnapshot.empty) {
        await addDoc(collection(db, `communityMembers`), { communityId });
      }

      // Store the approved community ID and name in the 'YourIds' collection specific to the requester's user ID
      const requesterYourIdsRef = doc(db, 'YourIds', requesterId);
      const requesterDocSnapshot = await getDoc(requesterYourIdsRef);

      // Check if requester document exists
      if (requesterDocSnapshot.exists()) {
        const requesterYourIds = requesterDocSnapshot.data().yourIds || [];
        // Update requester document with the new approved community ID and name
        await updateDoc(requesterYourIdsRef, { yourIds: [...requesterYourIds, { communityId, communityName }] });
      } else {
        // Create a new requester document with the approved community ID and name
        await setDoc(requesterYourIdsRef, { yourIds: [{ communityId, communityName }] });
      }

      // Optional: Remove the approved request from the state
      setRequests(prevRequests => prevRequests.filter(request => request.id !== requestId));
    } catch (error) {
      console.error('Error approving request:', error);
      // Handle error here
    }
  };

  return (
    <div className="py-10 ">
      <h2 className="mb-4 font-semibold md:text-xl text:sm">Requests to Join Your Communities:</h2>
      <div className="">
        <table className="w-full my-4 text-xs bg-white rounded shadow table-auto md:text-base">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-1 md:py-2 md:px-3">Community Name</th>
              <th className="p-1md:py-2 md:px-3">User Name</th>
              <th className="p-1 md:py-2 md:px-3">Status</th>
              <th className="p-1 md:py-2 md:px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="p-1 border md:py-2 md:px-3">{request.communityName}</td>
                <td className="p-1 border md:py-2 md:px-3">{request.userName}</td>
                <td className="p-1 border md:py-2 md:px-3">{request.status}</td>
                <td className="p-1 border md:py-2 md:px-3">
                  {request.status === 'pending' && (
                    <button onClick={() => {
                      console.log("Request ID:", request.id);
                      console.log("Community ID:", request.communityId);
                      console.log("Community Name:", request.communityName);
                      approveRequest(request.id, request.communityId, request.communityName);
                    }} className="px-3 py-1 mt-2 text-white bg-green-500 rounded-md">Approve</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    <button className="px-4 py-2 my-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700">
    <Link href="/UserTrack" className="text-white">
        Track Your Community
    </Link>
</button>


    </div>
  );
}

export default Dashboard;
