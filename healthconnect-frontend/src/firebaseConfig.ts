import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDbdQTKozRVixX28Y_pIGuTk9LGclpiEAw",
  authDomain: "health-monitor-5ad13.firebaseapp.com",
  databaseURL: "https://health-monitor-5ad13-default-rtdb.firebaseio.com",
  projectId: "health-monitor-5ad13",
  storageBucket: "health-monitor-5ad13.appspot.com",
  messagingSenderId: "354042134567",  // Replace with your actual messagingSenderId
  appId: "1:354042134567:web:a8b9c0d1e2f3g4h5i6j7k8",  // Replace with your actual appId
  measurementId: "G-MEASUREMENT_ID"  // Optional: add if you have Google Analytics
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app;
