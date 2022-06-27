let
  pkgs = import (builtins.fetchGit {
    name = "nixpkgs-22.05";
    url = "https://github.com/nixos/nixpkgs/";
    # `git ls-remote https://github.com/nixos/nixpkgs nixos-unstable`
    ref = "refs/tags/22.05";
    rev = "ce6aa13369b667ac2542593170993504932eb836";
  }) {};

in

pkgs.mkShell {
  buildInputs = [
    pkgs.yarn
    pkgs.nodejs
    pkgs.deno
  ];
}
