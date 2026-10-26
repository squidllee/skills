---
name: instabox-snapshots
description: Use when the user wants to save an instabox box's state and load it later — "save a snapshot", "checkpoint this box", "restore/load from a snapshot", "start a new box from my setup", "clone this box". Covers instabox snapshot save/ls/files/rm and create --snapshot.
metadata:
  installed-by: instabox
---

# instabox snapshots: save and load

A snapshot is a saved copy of a box's disks (root disk and `/data`), private to the account. Load it by creating a new box from it. Snapshots hold disks only: running processes and memory are not saved (use `instabox suspend` for that).

## Save

```sh
instabox snapshot save work --name work-ready --description "deps installed, repo cloned"
```

- A running box is saved live, without stopping it: the snapshot is `pending` in `instabox snapshot ls` until its disks finish uploading (`--no-wait` returns at once).
- Do not stop the box first: `stop` ends every process in it. A live snapshot is like a clean power cut: what is on disk is kept, what programs hold only in memory is not. Only if the server answers that this box must be stopped, or if a program must write its data to disk first (a database mid-write), run `instabox stop work`, save, then `instabox start work`.
- `--root-only` saves just the root disk (smaller; `/data` is not included).
- A disk snapshot includes credential files written by applications, tool sign-ins, and historical Vault files. The managed Secret environment lives on tmpfs, but applications can copy real env values to disk; a suspend snapshot can also retain them in process memory. Do not describe snapshots as credential-free. Review copied credentials and rotate upstream when required before sharing or retaining them.
- Pick names that say what is inside (`node20-playwright`, `api-db-seeded`); names must be unique among your snapshots.

## Load

```sh
instabox snapshot ls                                    # your snapshots: id, name, root/data size, source
instabox create --name work2 --snapshot work-ready
instabox exec work2 -- ls /data/home                    # same root disk and /data as when saved
```

`--snapshot` takes a snapshot name or its `sn_...` id.

## Look inside without starting anything

```sh
instabox snapshot files work-ready /etc                 # list a directory of the root disk
instabox snapshot files work-ready /etc/os-release      # print a text file
```

This reads the snapshot's root disk only; `/data` (and HOME) are not browsable here. To check files under `/data`, load the snapshot into a box and use `instabox exec`.

## Copy a box

There is no direct copy: save a snapshot of it, create the new box from that, and delete the snapshot if you will not use it again.

```sh
instabox snapshot save work --name work-copy
instabox create --name work2 --snapshot work-copy
instabox snapshot rm work-copy                          # optional; work2 is not affected
```

The copy gets a new sandbox identity and the selections in its creation request. Without Secret selection flags it keeps the existing Vault behavior and does not enroll in org Secrets; it does not inherit the source's explicit grants or exclusions. To disable new delivery from both stores, use:

```sh
instabox create --name work2 --snapshot work-copy --no-vault --secrets none --env-secrets none
```

To provide a database credential, select its env Secret explicitly with `--env-secrets DATABASE_URL`. At creation that flag alone also selects all org proxy Secrets; add `--secrets none` or specific names to narrow proxy access. Copied placeholders cannot authorize use as the source sandbox. New selections do not erase real credentials already present in copied files; a new proxy identity does not make those files safe to share.

## Clean up

```sh
instabox snapshot rm work-ready
```

Snapshots count toward the account's snapshot and storage limits (`instabox usage`). Delete ones you no longer need.

## Typical agent loop

1. `instabox create --name job --snapshot <base>` (it pauses by itself after 30 idle minutes)
2. Work with `instabox exec job -- ...`
3. When the setup is worth keeping: `instabox snapshot save job --name <base>-v2` (no need to stop it)
4. `instabox rm job` when done.
