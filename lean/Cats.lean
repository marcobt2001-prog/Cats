/-
A smoke test for the CATS Lean project: if this builds, the toolchain and
Mathlib are in place and the notation the generator emits is available.
The real work is in the files CATS generates at run time.
-/
import Mathlib.CategoryTheory.Category.Basic

open CategoryTheory

universe u v

example {𝒞 : Type u} [Category.{v} 𝒞] {A B : 𝒞} (f : A ⟶ B) : 𝟙 A ≫ f = f := by
  simp
