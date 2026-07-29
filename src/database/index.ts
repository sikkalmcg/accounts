'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { addDoc, deleteDoc, setDoc, updateDoc } from './mongo';
export * from './mongo';

export function DatabaseProvider({ children }: { children: ReactNode }) { return children; }
export const useDatabase = () => useMemo(() => ({}), []);
export const useAuth = () => ({});
export const useUser = () => ({ user: null, isUserLoading: false, userError: null });
export const initiateAnonymousSignIn = (_auth: unknown) => undefined;
export const initiateEmailSignIn = (_auth: unknown, _email: string, _password: string) => undefined;
export const initiateEmailSignUp = (_auth: unknown, _email: string, _password: string) => undefined;
export const addDocumentNonBlocking = (ref: any, data: any) => addDoc(ref, data);
export const updateDocumentNonBlocking = (ref: any, data: any) => { void updateDoc(ref, data); };
export const setDocumentNonBlocking = (ref: any, data: any) => { void setDoc(ref, data); };
export const deleteDocumentNonBlocking = (ref: any) => { void deleteDoc(ref); };


