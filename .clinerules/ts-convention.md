# Code Conventions for TypeScript

## Concept

This file describes all the code conventions that the AI must follow to write clean and scalable code.

## Guidelines

- Do not use inline returns.
- If the expression within the sencentes are so much long... write them in a `const` first and then use it.
- Do use `for..of` loop instead of `.forEach` methods.
- Do use of `for..of` loop instead of `.map` methods.
- Declare explicitly public members and methods. It means, you need to use the `public` keyword.
- If it exists, do use of `UnsafeAny` instead of `any` type.
- Do not use `export default`.
- Enum members must be written on upper case.
- Optional members must be at the end of the interface and required members at the top of it.
- If all members of an interface are optional, then declare the interface with all member as required and do use of the `Partial` utility type when you use that interface.
- Prefix intefaces with `I` (e.g., IUser, INavOptions, IButtonProperties).
- Import files using using its extensions, this is important for TypeScript code (see: `example-4`).

## Examples

<examples>
  <example-1>
    <wrong>
      export interface IToastContextProps {
        toasts: IToast[];
        addToast: (toast: Omit<IToast, 'id'>) => void;
        removeToast: (id: string) => void;
      }
    </wrong>

    <correct>
      export interface IToastContextProps {
        toasts: IToast[];
        addToast(toast: Omit<IToast, 'id'>): void;
        removeToast(id: string): void;
      }
    </correct>
  </example-1>

  <example-2>
    <wrong>
      if (!user.isValid) return;
    </wrong>

    <correct>
      if (!user.isValid) {
        return;
      }
    </correct>
  </example-2>

  <example-3>
    <wrong>
      import { FlatList, ListDirection } from "./flat-list.component";
    </wrong>

    <correct>
      import { FlatList, ListDirection } from "./flat-list.component.tsx";
    </correct>
  </example-3>

  <example-4>
    <wrong>
      export enum ListItemStatus {
        PENDING = "pending",
        COMPLETED = "completed",
        IN_PROGRESS = "in-progress"
      }
    </wrong>

    <correct>
      export enum ListItemStatus {
        Pending = "pending",
        Completed = "completed",
        InProgress = "in-progress"
      }
    </correct>
  </example-4>
</examples>