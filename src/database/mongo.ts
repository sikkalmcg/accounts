'use client';

import { useEffect, useMemo, useState, type DependencyList } from 'react';

type Filter = { field: string; operator: string; value: unknown };
type Sort = { field: string; direction: 'asc' | 'desc' };
export type CollectionReference = { type: 'collection'; path: string; filters: Filter[]; sorts: Sort[]; take?: number; __memo?: boolean };
export type DocumentReference = { type: 'document'; path: string; collection: string; id: string };

export const collection = (_db: unknown, path: string): CollectionReference => ({ type: 'collection', path, filters: [], sorts: [] });
export function doc(reference: CollectionReference): DocumentReference;
export function doc(_db: unknown, path: string, id: string): DocumentReference;
export function doc(first: unknown, path?: string, id?: string): DocumentReference {
  if (typeof first === 'object' && first && 'type' in first) {
    const collection = first as CollectionReference; const generatedId = crypto.randomUUID();
    return { type: 'document', path: `${collection.path}/${generatedId}`, collection: collection.path, id: generatedId };
  }
  return { type: 'document', path: `${path}/${id}`, collection: path!, id: id! };
}
export const where = (field: string, operator: string, value: unknown): Filter => ({ field, operator, value });
export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc'): Sort => ({ field, direction });
export const limit = (take: number) => ({ take });
export const query = (reference: CollectionReference, ...constraints: (Filter | Sort | { take: number })[]): CollectionReference => ({
  ...reference,
  filters: [...reference.filters, ...constraints.filter((item): item is Filter => 'operator' in item)],
  sorts: [...reference.sorts, ...constraints.filter((item): item is Sort => 'direction' in item)],
  take: (constraints.find((item): item is { take: number } => 'take' in item) || {}).take,
});
export const serverTimestamp = () => new Date().toISOString();

const mongoQuery = (filters: Filter[]) => Object.fromEntries(filters.map(({ field, operator, value }) => [field, operator === '==' ? value : { [`$${operator === '>=' || operator === '<=' || operator === '>' || operator === '<' ? operator : 'eq'}`]: value }]));
const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Database request failed');
  return response.status === 204 ? null : response.json();
};
const urlFor = (reference: CollectionReference) => {
  const params = new URLSearchParams();
  if (reference.filters.length) params.set('query', JSON.stringify(mongoQuery(reference.filters)));
  if (reference.sorts.length) params.set('sort', JSON.stringify(Object.fromEntries(reference.sorts.map(({ field, direction }) => [field, direction === 'asc' ? 1 : -1]))));
  if (reference.take) params.set('limit', String(reference.take));
  return `/api/data/${reference.path}${params.size ? `?${params}` : ''}`;
};

export async function getDocs(reference: CollectionReference): Promise<{ empty: boolean; docs: { id: string; data: () => any }[] }> {
  const data = await request(urlFor(reference));
  return { empty: !data.length, docs: data.map((item: any) => ({ id: item.id, data: () => item })) };
}
export function useCollection<T = any>(reference: CollectionReference | null | undefined) {
  const [data, setData] = useState<(T & { id: string })[] | null>(null); const [isLoading, setIsLoading] = useState(Boolean(reference)); const [error, setError] = useState<Error | null>(null);
  useEffect(() => { if (!reference) { setData(null); return; } let active = true; setIsLoading(true); request(urlFor(reference)).then((value) => active && setData(value)).catch((cause) => active && setError(cause)).finally(() => active && setIsLoading(false)); return () => { active = false; }; }, [reference]);
  return { data, isLoading, error };
}
export function useMemoDatabase<T>(factory: () => T, deps: DependencyList): T { return useMemo(factory, deps); }
export const addDoc = (reference: CollectionReference, data: any) => request(`/api/data/${reference.path}`, { method: 'POST', body: JSON.stringify(data) });
export const updateDoc = (reference: DocumentReference, data: any) => request(`/api/data/${reference.collection}/${reference.id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const setDoc = (reference: DocumentReference, data: any) => request(`/api/data/${reference.collection}/${reference.id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteDoc = (reference: DocumentReference) => request(`/api/data/${reference.collection}/${reference.id}`, { method: 'DELETE' });


