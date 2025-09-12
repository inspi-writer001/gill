import * as borsh from "@coral-xyz/borsh";
import type { Address } from "@solana/kit";
import {
  type Idl,
  type IdlType,
  type IdlField,
  type IdlInstruction,
  type IdlAccount,
  type IdlTypeDef,
  type IdlTypeDefTy,
  isIdlTypeVec,
  isIdlTypeOption,
  isIdlTypeArray,
  isIdlTypeDefined,
} from "../idl";

/**
 * Interface for encoding/decoding data
 */
export interface Coder {
  instruction: InstructionCoder;
  accounts: AccountsCoder;
  events: EventsCoder;
  types: TypesCoder;
}

/**
 * Interface for instruction encoding
 */
export interface InstructionCoder {
  encode(instructionName: string, args: any): Uint8Array;
  decode(data: Uint8Array): { name: string; data: any } | null;
}

/**
 * Interface for account data encoding/decoding
 */
export interface AccountsCoder {
  encode<T = any>(accountName: string, account: T): Promise<Uint8Array>;
  decode<T = any>(accountName: string, data: Uint8Array): T;
  size(accountName: string): number;
  memcmp(
    accountName: string,
    filters?: Uint8Array,
  ): {
    offset?: number;
    bytes?: string;
    dataSize?: number;
  };
}

/**
 * Interface for event decoding
 */
export interface EventsCoder {
  decode<T = any>(eventName: string, data: Uint8Array): T | null;
}

/**
 * Interface for custom types encoding/decoding
 */
export interface TypesCoder {
  encode<T = any>(typeName: string, type: T): Uint8Array;
  decode<T = any>(typeName: string, data: Uint8Array): T;
}

/**
 * Borsh implementation of the Coder interface
 */
export class BorshCoder implements Coder {
  readonly instruction: BorshInstructionCoder;
  readonly accounts: BorshAccountsCoder;
  readonly events: BorshEventsCoder;
  readonly types: BorshTypesCoder;

  constructor(private readonly idl: Idl) {
    this.instruction = new BorshInstructionCoder(idl);
    this.accounts = new BorshAccountsCoder(idl);
    this.events = new BorshEventsCoder(idl);
    this.types = new BorshTypesCoder(idl);
  }
}

/**
 * Borsh instruction coder
 */
class BorshInstructionCoder implements InstructionCoder {
  private readonly instructionSchemas = new Map<string, any>();
  private readonly instructionDiscriminators = new Map<string, Uint8Array>();

  constructor(private readonly idl: Idl) {
    this.buildInstructionSchemas();
  }

  encode(instructionName: string, args: any): Uint8Array {
    const schema = this.instructionSchemas.get(instructionName);
    if (!schema) {
      throw new Error(`Instruction ${instructionName} not found in IDL`);
    }

    // Get discriminator (first 8 bytes for Anchor instructions)
    const discriminator = this.instructionDiscriminators.get(instructionName) || new Uint8Array(8);

    // Encode the arguments
    const argsEncoded = borsh.serialize(schema, args);

    // Combine discriminator + encoded args
    const result = new Uint8Array(discriminator.length + argsEncoded.length);
    result.set(discriminator, 0);
    result.set(argsEncoded, discriminator.length);

    return result;
  }

  decode(data: Uint8Array): { name: string; data: any } | null {
    // Extract discriminator (first 8 bytes)
    if (data.length < 8) return null;

    const discriminator = data.slice(0, 8);
    const argsData = data.slice(8);

    // Find instruction by discriminator
    for (const [name, disc] of this.instructionDiscriminators.entries()) {
      if (this.arraysEqual(discriminator, disc)) {
        const schema = this.instructionSchemas.get(name);
        if (schema) {
          const decoded = borsh.deserialize(schema, argsData);
          return { name, data: decoded };
        }
      }
    }

    return null;
  }

  private buildInstructionSchemas(): void {
    for (const instruction of this.idl.instructions) {
      // Build borsh schema for instruction args
      const schema = this.buildArgsSchema(instruction.args);
      this.instructionSchemas.set(instruction.name, schema);

      // Store discriminator
      const discriminator = instruction.discriminator
        ? new Uint8Array(instruction.discriminator)
        : this.generateDiscriminator(instruction.name);
      this.instructionDiscriminators.set(instruction.name, discriminator);
    }
  }

  private buildArgsSchema(args: IdlField[]): any {
    const fields: any = {};
    for (const arg of args) {
      fields[arg.name] = this.idlTypeToBorsh(arg.type);
    }
    return borsh.struct(fields);
  }

  private generateDiscriminator(instructionName: string): Uint8Array {
    // Simple discriminator generation - in practice this would use sha256 hash
    const hash = new TextEncoder().encode(instructionName);
    const result = new Uint8Array(8);
    for (let i = 0; i < Math.min(8, hash.length); i++) {
      result[i] = hash[i];
    }
    return result;
  }

  private arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  private idlTypeToBorsh(idlType: IdlType): any {
    if (typeof idlType === "string") {
      // Primitive types
      switch (idlType) {
        case "bool":
          return borsh.bool();
        case "u8":
          return borsh.u8();
        case "i8":
          return borsh.i8();
        case "u16":
          return borsh.u16();
        case "i16":
          return borsh.i16();
        case "u32":
          return borsh.u32();
        case "i32":
          return borsh.i32();
        case "u64":
          return borsh.u64();
        case "i64":
          return borsh.i64();
        case "u128":
          return borsh.u128();
        case "i128":
          return borsh.i128();
        case "f32":
          return borsh.f32();
        case "f64":
          return borsh.f64();
        case "string":
          return borsh.str();
        case "pubkey":
          return borsh.publicKey();
        case "bytes":
          return borsh.vecU8();
        default:
          throw new Error(`Unknown primitive type: ${idlType}`);
      }
    }

    if (isIdlTypeVec(idlType)) {
      return borsh.vec(this.idlTypeToBorsh(idlType.vec));
    }

    if (isIdlTypeOption(idlType)) {
      return borsh.option(this.idlTypeToBorsh(idlType.option));
    }

    if (isIdlTypeArray(idlType)) {
      const [elementType, size] = idlType.array;
      return borsh.array(this.idlTypeToBorsh(elementType), size);
    }

    if (isIdlTypeDefined(idlType)) {
      // This would reference a custom type - for now, just treat as bytes
      return borsh.vecU8();
    }

    throw new Error(`Unsupported IDL type: ${JSON.stringify(idlType)}`);
  }
}

/**
 * Borsh accounts coder
 */
class BorshAccountsCoder implements AccountsCoder {
  private readonly accountSchemas = new Map<string, any>();
  private readonly accountSizes = new Map<string, number>();

  constructor(private readonly idl: Idl) {
    this.buildAccountSchemas();
  }

  async encode<T = any>(accountName: string, account: T): Promise<Uint8Array> {
    const schema = this.accountSchemas.get(accountName);
    if (!schema) {
      throw new Error(`Account ${accountName} not found in IDL`);
    }

    return borsh.serialize(schema, account);
  }

  decode<T = any>(accountName: string, data: Uint8Array): T {
    const schema = this.accountSchemas.get(accountName);
    if (!schema) {
      throw new Error(`Account ${accountName} not found in IDL`);
    }

    return borsh.deserialize(schema, data) as T;
  }

  size(accountName: string): number {
    return this.accountSizes.get(accountName) || 0;
  }

  memcmp(
    accountName: string,
    filters?: Uint8Array,
  ): {
    offset?: number;
    bytes?: string;
    dataSize?: number;
  } {
    // For account filtering - would implement discriminator-based filtering
    const size = this.size(accountName);
    return {
      dataSize: size > 0 ? size : undefined,
      // Could add discriminator offset/bytes here for account filtering
    };
  }

  private buildAccountSchemas(): void {
    if (!this.idl.accounts) return;

    for (const account of this.idl.accounts) {
      const schema = this.buildAccountSchema(account);
      this.accountSchemas.set(account.name, schema);

      // Calculate size (simplified - would need more sophisticated calculation)
      this.accountSizes.set(account.name, 1000); // Placeholder size
    }
  }

  private buildAccountSchema(account: IdlAccount): any {
    const fields: any = {};
    for (const field of account.type.fields) {
      fields[field.name] = this.idlTypeToBorsh(field.type);
    }
    return borsh.struct(fields);
  }

  private idlTypeToBorsh(idlType: IdlType): any {
    // Reuse the same logic from instruction coder
    return new BorshInstructionCoder(this.idl)["idlTypeToBorsh"](idlType);
  }
}

/**
 * Borsh events coder (placeholder for now)
 */
class BorshEventsCoder implements EventsCoder {
  constructor(private readonly idl: Idl) {}

  decode<T = any>(eventName: string, data: Uint8Array): T | null {
    // Events decoding would be implemented here
    return null;
  }
}

/**
 * Borsh types coder (placeholder for now)
 */
class BorshTypesCoder implements TypesCoder {
  constructor(private readonly idl: Idl) {}

  encode<T = any>(typeName: string, type: T): Uint8Array {
    // Custom types encoding would be implemented here
    return new Uint8Array();
  }

  decode<T = any>(typeName: string, data: Uint8Array): T {
    // Custom types decoding would be implemented here
    return {} as T;
  }
}
