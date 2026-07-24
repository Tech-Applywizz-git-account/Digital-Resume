/**
 * Base Repository
 *
 * Generic CRUD operations for Supabase tables.
 * All domain repositories extend this class.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { getDatabase } from '../config/database.js';

export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
}

export class BaseRepository<T extends Record<string, unknown>> {
    protected db: SupabaseClient;

    constructor(
        protected tableName: string,
    ) {
        this.db = getDatabase();
    }

    async findOne(filters: Partial<T>): Promise<T | null> {
        let query = this.db.from(this.tableName).select('*');
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        }
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        return data as T | null;
    }

    async findMany(filters: Partial<T> = {}, options: QueryOptions = {}): Promise<T[]> {
        let query = this.db.from(this.tableName).select('*');
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        }
        if (options.orderBy) {
            query = query.order(options.orderBy, { ascending: options.orderDirection !== 'desc' });
        }
        if (options.limit) query = query.limit(options.limit);
        if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as T[];
    }

    async create(data: Partial<T>): Promise<T> {
        const { data: created, error } = await this.db
            .from(this.tableName)
            .insert(data as any)
            .select()
            .single();
        if (error) throw error;
        return created as T;
    }

    async update(filters: Partial<T>, data: Partial<T>): Promise<T | null> {
        let query = this.db.from(this.tableName).update(data as any).select();
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        }
        const { data: updated, error } = await query.single();
        if (error) throw error;
        return updated as T | null;
    }

    async delete(filters: Partial<T>): Promise<void> {
        let query = this.db.from(this.tableName).delete();
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        }
        const { error } = await query;
        if (error) throw error;
    }

    async count(filters: Partial<T> = {}): Promise<number> {
        let query = this.db.from(this.tableName).select('*', { count: 'exact', head: true });
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                query = query.eq(key, value);
            }
        }
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
    }
}