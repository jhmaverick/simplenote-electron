import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import appState from '../flux/app-state';
import { tracks } from '../analytics';
import { search } from '../state/ui/actions';

import * as S from '../state';
import * as T from '../types';

const { setSearchFocus } = appState.actionCreators;
const { recordEvent } = tracks;

type StateProps = {
  filteredTags: T.TagEntity[];
  searchQuery: string;
};

type DispatchProps = {
  onSearch: (query: string) => any;
};

type Props = StateProps & DispatchProps;

export class TagSuggestions extends Component<Props> {
  static displayName = 'TagSuggestions';

  updateSearch = (nextSearch: string) => {
    const { searchQuery, onSearch } = this.props;

    // replace last word in current searchQuery with requested tag match
    let newQuery = searchQuery.trim().split(' ');
    newQuery.splice(-1, 1, nextSearch);
    let querystring = newQuery.join(' ');

    // add a space at the end so the user can immediately start typing
    querystring += ' ';
    onSearch(querystring);
  };

  render() {
    const { filteredTags } = this.props;

    return (
      <Fragment>
        {filteredTags.length > 0 && (
          <div className="tag-suggestions">
            <div className="note-list-header">Search by Tag</div>
            <ul className="tag-suggestions-list">
              {filteredTags.map(tag => (
                <li
                  key={tag.id}
                  id={tag.id}
                  className="tag-suggestion-row"
                  onClick={() => this.updateSearch(`tag:${tag.data.name}`)}
                >
                  <div className="tag-suggestion" title={tag.data.name}>
                    tag:{tag.data.name}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Fragment>
    );
  }
}

/**
 * Return the first maxResults matching items in the list
 *
 * This is like items.filter(predicate).slice(0,maxResults)
 * but it early-aborts as soon as we find our max results.
 * If we were filtering thousands of tags, for example, there'd
 * be no reason to iterate through all of them and only prune
 * the list after computing whether each one matches.
 *
 * @param items items to filter
 * @param predicate filtering function
 * @param maxResults maximum number of returned matching items
 */
const filterAtMost = function<I>(
  items: I[],
  predicate: (item: I) => boolean,
  maxResults: number
): I[] {
  const results = [];
  for (const item of items) {
    if (predicate(item)) {
      results.push(item);
    }

    if (results.length === maxResults) {
      break;
    }
  }
  return results;
};

export const filterTags = (tags: T.TagEntity[], query: string) => {
  // we'll only suggest matches for the last word
  // ...this is possibly naive if the user has moved back and is editing,
  // but without knowing where the cursor is it's maybe the best we can do
  const tagTerm = query
    .trim()
    .split(' ')
    .pop();

  if (!tagTerm) {
    return tags;
  }

  // with `tag:` we don't want to suggest tags which have already been added
  // to the search bar, so we make it an explicit prefix match, meaning we
  // don't match inside the tag and we don't match full-text matches
  const isPrefixMatch = tagTerm.startsWith('tag:') && tagTerm.length > 4;
  const term = isPrefixMatch ? tagTerm.slice(4) : tagTerm;

  const matcher: (tag: T.TagEntity) => boolean = isPrefixMatch
    ? ({ data: { name } }) => name !== term && name.startsWith(term)
    : ({ data: { name } }) => name.includes(term);

  return filterAtMost(tags, matcher, 5);
};

let lastTags = null;
let lastQuery = null;
let lastMatches = [];
export const getMatchingTags = (tags, query) => {
  if (lastTags === tags && lastQuery === query) {
    return lastMatches;
  }

  lastTags = tags;
  lastQuery = query;
  lastMatches = filterTags(tags, query);
  return lastMatches;
};

const mapStateToProps: S.MapState<StateProps> = ({
  appState: state,
  ui: { searchQuery },
}) => ({
  filteredTags: getMatchingTags(state.tags, searchQuery),
  searchQuery,
});

const mapDispatchToProps: S.MapDispatch<DispatchProps> = dispatch => ({
  onSearch: query => {
    dispatch(search(query));
    recordEvent('list_notes_searched');
    dispatch(setSearchFocus({ searchFocus: true }));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(TagSuggestions);
