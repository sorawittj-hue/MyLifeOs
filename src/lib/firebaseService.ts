import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  QueryConstraint,
  writeBatch
} from "firebase/firestore";
import { db, auth } from "./firebase";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, shouldThrow: boolean = true): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  // Log structured error for easy debugging
  console.error(`[FIRESTORE ERROR] ${operationType} on ${path}:`, {
    message: errInfo.error,
    code: (error as any)?.code,
    userId: errInfo.authInfo.userId,
    isAuthenticated: !!auth.currentUser,
    operationType,
    path
  });

  // Throw a proper error with details if requested
  if (shouldThrow) {
    const errorMessage = `[${operationType}] ${errInfo.error} (User: ${errInfo.authInfo.userId || 'anonymous'}, Path: ${path || 'unknown'})`;
    throw new Error(errorMessage);
  }
}

export const firebaseService = {
  // User Profile
  async getUserProfile(uid: string) {
    const path = `users/${uid}`;
    try {
      console.log(`[FirebaseService] Getting user profile: ${path}`);
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      const data = docSnap.exists() ? docSnap.data() : null;
      console.log(`[FirebaseService] User profile ${docSnap.exists() ? 'found' : 'not found'}`);
      return data;
    } catch (error) {
      console.error(`[FirebaseService] Failed to get user profile:`, error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  async setUserProfile(uid: string, data: any) {
    const path = `users/${uid}`;
    try {
      console.log(`[FirebaseService] Setting user profile: ${path}`, { uid, dataKeys: Object.keys(data) });
      const docRef = doc(db, "users", uid);
      await setDoc(docRef, { ...data, uid }, { merge: true });
      console.log(`[FirebaseService] User profile saved successfully`);
    } catch (error) {
      console.error(`[FirebaseService] Failed to set user profile:`, error);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Generic Collection Methods

  /**
   * Subscribe to a Firestore collection with optional query constraints.
   * Returns an `unsubscribe` function — call it inside a useEffect cleanup.
   *
   * @example
   * const unsub = firebaseService.subscribeToCollection<FoodLog>(
   *   'foodLogs', uid, [where('date','==',today)], (docs) => setFoods(docs)
   * );
   * return () => unsub();
   */
  subscribeToCollection<T>(
    collectionName: string,
    uid: string,
    queryConstraints: QueryConstraint[],
    callback: (data: T[]) => void,
  ): () => void {
    console.log(`[FirebaseService] Subscribing to ${collectionName} for user ${uid}`);
    const q = query(
      collection(db, collectionName),
      where('uid', '==', uid),
      ...queryConstraints,
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
        callback(data);
      },
      (error) => {
        console.error(`[FirebaseService] Subscription error for ${collectionName}:`, error);
        handleFirestoreError(error, OperationType.LIST, collectionName, false);
      },
    );

    return unsubscribe;
  },

  async getCollection<T>(collectionName: string, uid: string, queryConstraints: QueryConstraint[] = []): Promise<T[]> {
    const path = collectionName;
    try {
      console.log(`[FirebaseService] Getting collection ${collectionName} for user ${uid}`);
      const q = query(
        collection(db, collectionName),
        where("uid", "==", uid),
        ...queryConstraints
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      console.log(`[FirebaseService] Retrieved ${data.length} documents from ${collectionName}`);
      return data;
    } catch (error) {
      console.error(`[FirebaseService] Failed to get collection ${collectionName}:`, error);
      handleFirestoreError(error, OperationType.LIST, path, false);
      return [];
    }
  },

  async addToCollection<T>(collectionName: string, data: T) {
    const path = collectionName;
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        console.error(`[FirebaseService] Cannot add to ${collectionName}: User not authenticated`);
        throw new Error("User not authenticated");
      }
      console.log(`[FirebaseService] Adding to ${collectionName}`, { uid, dataType: typeof data });
      const docRef = await addDoc(collection(db, collectionName), { ...data, uid });
      console.log(`[FirebaseService] Added document to ${collectionName} with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error(`[FirebaseService] Failed to add to collection ${collectionName}:`, error);
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateInCollection<T>(collectionName: string, id: string, data: Partial<T>) {
    const path = `${collectionName}/${id}`;
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, data as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteFromCollection(collectionName: string, id: string) {
    const path = `${collectionName}/${id}`;
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async batchAdd(collectionName: string, items: any[], uid: string) {
    const path = collectionName;
    try {
      const batch = writeBatch(db);
      items.forEach(item => {
        const docRef = doc(collection(db, collectionName));
        batch.set(docRef, { ...item, uid, syncedAt: serverTimestamp() });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
};
