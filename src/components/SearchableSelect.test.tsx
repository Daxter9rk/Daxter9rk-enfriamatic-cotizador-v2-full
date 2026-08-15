import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {SearchableSelect} from './SearchableSelect';

describe('SearchableSelect controlado', () => {
  it('limpia la etiqueta visible cuando el valor controlado se limpia', () => {
    const onChange = vi.fn();
    const {rerender} = render(
      <SearchableSelect
        name="siteId"
        label="Instalación"
        value="site-1"
        options={[{value: 'site-1', label: 'Planta anterior'}]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('searchbox', {name: 'Instalación'})).toHaveValue('Planta anterior');

    rerender(
      <SearchableSelect
        name="siteId"
        label="Instalación"
        value=""
        options={[]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('searchbox', {name: 'Instalación'})).toHaveValue('');
  });
});
