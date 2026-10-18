import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import { changeRole, type Users } from '../functions/admin-users'
import {
  ADMIN_MAX_PAGES,
  ADMIN_PAGE,
  searchHref,
  type UsersSearch,
  usersSearchSchema,
} from '../shared/admin-search'
import { type Role, roleLabels, roles } from '../shared/roles'
import { FilterForm } from './forms/filter-form'
import { FilterSearch } from './forms/filter-search'
import { PageHead } from './layout/page-head'
import { Avatar } from './ui/avatar'
import { cell, DataTable } from './ui/data-table'
import { DateText } from './ui/date-text'
import { PostForm } from './ui/post-form'
import { ShowMore } from './ui/show-more'
import { Tabs } from './ui/tabs'
import { buttonGhost, filterSelect, panel, tag } from './ui/ui'

const tabNames: Record<Role, string> = {
  admin: 'Admins',
  moderator: 'Moderators',
  user: 'Users',
}

/**
 * The site's accounts: to find someone and give them a role. Staff come
 * first. A role applies on the next page its holder loads.
 */
export function AdminUsers(props: { data: Users; search: UsersSearch }) {
  const data = () => props.data
  const href = (role?: Role) =>
    searchHref('/admin/users', { ...props.search, role, page: undefined })
  // Staff are few; a role tab lists them first.
  const tabRoles = [...roles].reverse()

  return (
    <>
      <PageHead
        bare
        title="Users and roles"
        lead="Everyone who has signed in. Moderators review what is sent in; admins also run the site."
      />
      <Tabs
        label="Roles"
        items={[
          {
            name: 'All',
            href: href(),
            count: roles.reduce((sum, role) => sum + data().counts[role], 0),
            current: !props.search.role,
          },
          ...tabRoles.map((role) => ({
            name: tabNames[role],
            href: href(role),
            count: data().counts[role],
            current: props.search.role === role,
          })),
        ]}
      />
      <FilterForm
        schema={usersSearchSchema}
        class="flex flex-wrap items-center gap-2 py-4"
      >
        <Show when={props.search.role}>
          {(role) => <input type="hidden" name="role" value={role()} />}
        </Show>
        <FilterSearch
          value={props.search.q}
          placeholder="Name or Discord id"
          class="w-full sm:w-72"
        />
      </FilterForm>

      <Show
        when={data().items.length > 0}
        fallback={
          <p class={`${panel} px-5 py-10 text-center text-fg-2`}>
            Nobody matches.
          </p>
        }
      >
        <DataTable
          label="Accounts"
          minWidth={720}
          columns={[
            { name: 'Account' },
            { name: 'Role' },
            { name: 'Experiences', numeric: true },
            { name: 'Joined' },
          ]}
        >
          <For each={data().items}>
            {(person) => (
              <tr>
                <td class={cell}>
                  <div class="flex items-center gap-3">
                    <Avatar
                      name={person.name}
                      image={person.image}
                      class="size-8 text-[11px]"
                    />
                    <div class="min-w-0">
                      <p class="flex flex-wrap items-center gap-2 font-semibold">
                        {person.name}
                        <Show when={person.hidden}>
                          <span class={`${tag} border-line-strong text-fg-3`}>
                            Name hidden
                          </span>
                        </Show>
                      </p>
                      <Show when={person.discordId}>
                        {(id) => (
                          <p class="font-mono text-xs text-fg-3">{id()}</p>
                        )}
                      </Show>
                    </div>
                  </div>
                </td>
                <td class={cell}>
                  <Show
                    when={!person.you}
                    fallback={
                      <p class="text-fg-2">
                        {roleLabels[person.role]}.{' '}
                        <span class="text-[13px] text-fg-3">
                          Another admin changes your role.
                        </span>
                      </p>
                    }
                  >
                    <PostForm
                      action={changeRole}
                      class="flex flex-wrap items-center gap-2"
                      aria-label={`Role of ${person.name}`}
                    >
                      <input type="hidden" name="userId" value={person.id} />
                      <select
                        name="role"
                        aria-label="Role"
                        class={`${filterSelect} h-[34px] border border-line-strong px-2 text-fg`}
                      >
                        <For each={roles}>
                          {(role) => (
                            <option
                              value={role}
                              selected={person.role === role}
                            >
                              {roleLabels[role]}
                            </option>
                          )}
                        </For>
                      </select>
                      <button
                        type="submit"
                        class={`${buttonGhost} h-[34px] px-3 text-xs`}
                      >
                        Save
                      </button>
                    </PostForm>
                  </Show>
                </td>
                <td class={`${cell} text-right font-mono`}>{person.made}</td>
                <td class={`${cell} whitespace-nowrap text-fg-2`}>
                  <DateText value={person.joinedAt} now={data().now} />
                </td>
              </tr>
            )}
          </For>
        </DataTable>
        <ShowMore
          shown={data().items.length}
          total={data().total}
          page={data().page}
          lastPage={ADMIN_MAX_PAGES}
        >
          <Link
            to="/admin/users"
            search={{ ...props.search, page: data().page + 1 }}
            resetScroll={false}
            class={buttonGhost}
          >
            Show {ADMIN_PAGE} more
          </Link>
        </ShowMore>
      </Show>
    </>
  )
}
