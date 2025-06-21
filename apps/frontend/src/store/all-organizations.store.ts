import { Organization } from "@equip-track/shared";
import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";


interface AllOrganizationsState {
  organizations: Organization[];
}

const mockedOrganizations: AllOrganizationsState = {
  organizations: [
    {
      id: '1',
      name: 'Hogwarts',
      imageUrl: 'https://via.placeholder.com/150',
    },
    {
      id: '2',
      name: 'Gryffindor',
      imageUrl: 'https://via.placeholder.com/150',
    },
  ],
};

export const AllOrganizationsStore = signalStore(
  { providedIn: 'root' },
  withState(mockedOrganizations),
  withMethods((store) => ({
    setOrganizations(organizations: Organization[]) {
      patchState(store, (state) => {
        return {
          ...state,
          organizations,
        };
      });
    },
  })),
);